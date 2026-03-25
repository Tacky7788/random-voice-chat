import { OnePlugin, PluginRequest, PluginResponse } from '@onecomme.com/onesdk/dist/types/Plugin'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as http from 'http'
import { execFile } from 'child_process'

type EngineConfig = {
  url: string
  enabled: boolean
  apiPrefix: string  // '' for VOICEVOX, '/v1' for COEIROINK
}

type PluginConfig = {
  engines: EngineConfig[]
  enabled: boolean
  speakers: string[]  // "engine_index:speaker_id" 形式 e.g. "0:3", "1:0"
  sameVoicePerUser: boolean
  speed: number
  volume: number
  pitch: number
  intonation: number
  maxLength: number
}

type SpeakerStyle = {
  id: number
  name: string
}

type SpeakerInfo = {
  name: string
  engine: string  // エンジンインデックス文字列 "0", "1" 等
  styles: SpeakerStyle[]
}

type SpeakerChoice = {
  engine: string      // エンジンインデックス文字列
  engineUrl: string
  apiPrefix: string
  speakerId: number
}

const DEFAULT_CONFIG: PluginConfig = {
  engines: [
    { url: 'http://127.0.0.1:50021', enabled: true, apiPrefix: '' },
    { url: 'http://127.0.0.1:50032', enabled: true, apiPrefix: '/v1' }
  ],
  enabled: true,
  speakers: [],
  sameVoicePerUser: true,
  speed: 1.2,
  volume: 1.0,
  pitch: 0,
  intonation: 1.0,
  maxLength: 100
}

let config: PluginConfig = { ...DEFAULT_CONFIG }
let allSpeakerChoices: SpeakerChoice[] = []
let speakerList: SpeakerInfo[] = []
let configPath = ''
const userVoiceMap = new Map<string, SpeakerChoice>()

let isPlaying = false
const queue: (() => void)[] = []

function loadConfig(dir: string): void {
  configPath = path.join(dir, 'config.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      // 後方互換: speakers が数値配列（旧形式）の場合は engine 0 として変換
      if (Array.isArray(parsed.speakers) && parsed.speakers.length > 0 && typeof parsed.speakers[0] === 'number') {
        parsed.speakers = (parsed.speakers as number[]).map((id) => `0:${id}`)
      }
      config = { ...DEFAULT_CONFIG, ...parsed }
      console.log('[random-voice-chat] Loaded config:', configPath)
    } else {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
      console.log('[random-voice-chat] Created default config:', configPath)
    }
  } catch (e) {
    console.error('[random-voice-chat] Config error, using defaults:', e)
    config = { ...DEFAULT_CONFIG }
  }
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function httpPostJson(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function httpPostBinary(url: string, body: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function loadSpeakersFromEngine(engine: EngineConfig, engineIndex: number): Promise<void> {
  const prefix = engine.apiPrefix
  try {
    const raw = await httpGet(`${engine.url}${prefix}/speakers`)
    const parsed = JSON.parse(raw)

    const infos: SpeakerInfo[] = []
    const choices: SpeakerChoice[] = []

    for (const sp of parsed) {
      // VOICEVOX: { name, styles: [{ id, name }] }
      // COEIROINK: { speakerName, styles: [{ styleId, styleName }] }
      const spName: string = sp.name ?? sp.speakerName ?? 'Unknown'
      const styles: SpeakerStyle[] = (sp.styles as Array<Record<string, unknown>>).map((st) => ({
        id: (st.id ?? st.styleId) as number,
        name: (st.name ?? st.styleName ?? '') as string
      }))

      infos.push({
        name: spName,
        engine: String(engineIndex),
        styles
      })

      for (const st of styles) {
        choices.push({
          engine: String(engineIndex),
          engineUrl: engine.url,
          apiPrefix: prefix,
          speakerId: st.id
        })
      }
    }

    speakerList.push(...infos)
    allSpeakerChoices.push(...choices)
    console.log(`[random-voice-chat] Engine[${engineIndex}] ${engine.url}: loaded ${infos.length} speakers`)
  } catch (e) {
    console.warn(`[random-voice-chat] Engine[${engineIndex}] ${engine.url}: failed to load speakers (not running?)`, e)
  }
}

async function loadSpeakers(): Promise<void> {
  speakerList = []
  allSpeakerChoices = []

  const engines = config.engines ?? DEFAULT_CONFIG.engines
  await Promise.all(
    engines
      .filter((e) => e.enabled)
      .map((e, idx) => loadSpeakersFromEngine(e, idx))
  )

  console.log(`[random-voice-chat] Total speaker styles: ${allSpeakerChoices.length}`)
}

function getPool(): SpeakerChoice[] {
  if (config.speakers.length > 0) {
    return allSpeakerChoices.filter((c) =>
      config.speakers.includes(`${c.engine}:${c.speakerId}`)
    )
  }
  return allSpeakerChoices.length > 0 ? allSpeakerChoices : [
    { engine: '0', engineUrl: 'http://127.0.0.1:50021', apiPrefix: '', speakerId: 1 }
  ]
}

function pickSpeaker(userId: string): SpeakerChoice {
  if (config.sameVoicePerUser && userVoiceMap.has(userId)) {
    return userVoiceMap.get(userId)!
  }
  const pool = getPool()
  const choice = pool[Math.floor(Math.random() * pool.length)]
  if (config.sameVoicePerUser) {
    userVoiceMap.set(userId, choice)
  }
  return choice
}

function runNext(): void {
  if (queue.length === 0) {
    isPlaying = false
    return
  }
  isPlaying = true
  const task = queue.shift()!
  task()
}

async function synthesizeAndPlay(text: string, choice: SpeakerChoice): Promise<void> {
  const { engineUrl, apiPrefix, speakerId } = choice
  const encodedText = encodeURIComponent(text)
  const queryUrl = `${engineUrl}${apiPrefix}/audio_query?text=${encodedText}&speaker=${speakerId}`
  const audioQueryStr = await httpPostJson(queryUrl, '')

  const audioQuery = JSON.parse(audioQueryStr)
  audioQuery.speedScale = config.speed
  audioQuery.volumeScale = config.volume
  audioQuery.pitchScale = config.pitch
  audioQuery.intonationScale = config.intonation
  const modifiedQuery = JSON.stringify(audioQuery)

  const synthUrl = `${engineUrl}${apiPrefix}/synthesis?speaker=${speakerId}`
  const wavBuffer = await httpPostBinary(synthUrl, modifiedQuery)

  const tmpFile = path.join(
    os.tmpdir(),
    `rvc_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
  )
  fs.writeFileSync(tmpFile, wavBuffer)

  const winPath = tmpFile.replace(/\//g, '\\')

  await new Promise<void>((resolve) => {
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-c',
        `(New-Object System.Media.SoundPlayer '${winPath}').PlaySync()`
      ],
      { windowsHide: true },
      (err) => {
        if (err) console.error('[random-voice-chat] Playback error:', err)
        try { fs.unlinkSync(tmpFile) } catch {}
        resolve()
      }
    )
  })
}

function enqueue(text: string, choice: SpeakerChoice): void {
  queue.push(() => {
    synthesizeAndPlay(text, choice)
      .catch((e) => console.error('[random-voice-chat] TTS error:', e))
      .finally(() => runNext())
  })
  if (!isPlaying) runNext()
}

const plugin: OnePlugin = {
  name: 'Random Voice Chat',
  uid: 'com.rippy.random-voice-chat',
  version: '0.0.1',
  author: 'rippy',
  permissions: ['filter.speech'],
  defaultState: {},
  url: 'http://localhost:11180/plugins/com.rippy.random-voice-chat/index.html',

  init({ dir, store }, initialData) {
    loadConfig(dir)
    loadSpeakers()
  },

  destroy() {
    queue.length = 0
    userVoiceMap.clear()
  },

  async request(req: PluginRequest): Promise<PluginResponse> {
    if (req.method === 'GET') {
      if (speakerList.length === 0) {
        await loadSpeakers()
      }
      return {
        code: 200,
        response: JSON.stringify({ config, speakers: speakerList })
      }
    }
    if (req.method === 'PUT') {
      try {
        const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
        const newConfig: Partial<PluginConfig> = raw
        // 後方互換: speakers が数値配列の場合は engine 0 として変換
        if (Array.isArray(newConfig.speakers) && newConfig.speakers.length > 0 && typeof newConfig.speakers[0] === 'number') {
          newConfig.speakers = (newConfig.speakers as unknown as number[]).map((id) => `0:${id}`)
        }
        config = { ...DEFAULT_CONFIG, ...newConfig }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
        userVoiceMap.clear()
        return { code: 200, response: JSON.stringify({ success: true }) }
      } catch (e) {
        return { code: 500, response: JSON.stringify({ error: String(e) }) }
      }
    }
    return { code: 405, response: JSON.stringify({ error: 'Method Not Allowed' }) }
  },

  async filterSpeech(text, userData, cfg, comment?) {
    if (!config.enabled) return text
    const userId = userData?.id ?? 'unknown'
    const choice = pickSpeaker(userId)
    const cleanText = config.maxLength > 0 ? text.slice(0, config.maxLength) : text
    enqueue(cleanText, choice)
    return false
  }
}

module.exports = plugin
