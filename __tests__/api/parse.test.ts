import { POST } from '@/app/api/parse/route'

// Mock fetch
global.fetch = jest.fn()

describe('/api/parse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DOUYIN_API_URL = 'http://test-api:8080'
  })

  it('returns error for missing URL', async () => {
    const request = {
      json: async () => ({ url: '' }),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('INVALID_URL')
  })

  it('validates Douyin URL format', async () => {
    const request = {
      json: async () => ({ url: 'https://google.com' }),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('NOT_DOUYIN_URL')
  })

  it('accepts valid Douyin short URL', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: {
          type: 'video',
          title: '测试视频',
          video_url: 'http://example.com/video.mp4',
        },
      }),
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const request = {
      json: async () => ({ url: 'https://v.douyin.com/abc123/' }),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api:8080/api/parse',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Referer: 'https://www.douyin.com/',
        }),
      })
    )
    expect(data.success).toBe(true)
  })

  it('handles timeout errors', async () => {
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        name: 'AbortError',
      })
    )

    const request = {
      json: async () => ({ url: 'https://v.douyin.com/abc123/' }),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(504)
    expect(data.error.code).toBe('TIMEOUT')
  })

  it('handles API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const request = {
      json: async () => ({ url: 'https://v.douyin.com/abc123/' }),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('PARSE_FAILED')
  })

  it('adds anti-hotlinking headers', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: {} }),
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const request = {
      json: async () => ({ url: 'https://v.douyin.com/abc123/' }),
    } as any

    await POST(request)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Referer: 'https://www.douyin.com/',
          'User-Agent': expect.stringContaining('Mozilla'),
        }),
      })
    )
  })
})
