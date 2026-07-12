import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const boardMocks = vi.hoisted(() => ({
  getBoardMeetings: vi.fn(),
  createBoardMeeting: vi.fn(),
  getBoardMeetingById: vi.fn(),
  updateBoardMeeting: vi.fn(),
  deleteBoardMeeting: vi.fn(),
}))
vi.mock('@/services/board/board-meeting-service', () => ({
  BoardMeetingService: {
    getBoardMeetings: boardMocks.getBoardMeetings,
    createBoardMeeting: boardMocks.createBoardMeeting,
    getBoardMeetingById: boardMocks.getBoardMeetingById,
    updateBoardMeeting: boardMocks.updateBoardMeeting,
    deleteBoardMeeting: boardMocks.deleteBoardMeeting,
  },
}))

import { GET as getList, POST as postMeeting } from '@/app/api/board/meetings/route'
import {
  GET as getOne,
  PUT as putMeeting,
  DELETE as deleteMeeting,
} from '@/app/api/board/meetings/[id]/route'
import type { AuthUser } from '@/lib/auth'

const user: AuthUser = {
  id: 'user-1',
  email: 'acct@example.com',
  name: 'Accountant',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  cookie: string | undefined,
  body?: unknown
): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  return new NextRequest(url, init)
}

const meeting = {
  id: 'm1',
  companyId: 'company-1',
  meetingDate: '2024-03-01',
  meetingType: 'regular',
  minutes: null,
}

describe('GET /api/board/meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await getList(
      buildRequest('http://localhost/api/board/meetings', 'GET', undefined)
    )

    expect(response.status).toBe(401)
    expect(boardMocks.getBoardMeetings).not.toHaveBeenCalled()
  })

  it('returns 401 when the user has no company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue({ ...user, companyId: null })

    const response = await getList(
      buildRequest('http://localhost/api/board/meetings', 'GET', 'session=valid-token')
    )

    expect(response.status).toBe(401)
    expect(boardMocks.getBoardMeetings).not.toHaveBeenCalled()
  })

  it('returns meetings for the user company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetings.mockResolvedValue([meeting])

    const response = await getList(
      buildRequest('http://localhost/api/board/meetings', 'GET', 'session=valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([meeting])
    expect(boardMocks.getBoardMeetings).toHaveBeenCalledWith('company-1')
  })
})

describe('POST /api/board/meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postMeeting(
      buildRequest('http://localhost/api/board/meetings', 'POST', 'session=valid-token', {
        meetingType: 'regular',
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
    expect(boardMocks.createBoardMeeting).not.toHaveBeenCalled()
  })

  it('returns 400 when meetingType is not a known enum value', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postMeeting(
      buildRequest('http://localhost/api/board/meetings', 'POST', 'session=valid-token', {
        meetingDate: '2024-04-01',
        meetingType: 'board',
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
    expect(boardMocks.createBoardMeeting).not.toHaveBeenCalled()
  })

  it('returns 400 when meetingDate is not a valid date', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postMeeting(
      buildRequest('http://localhost/api/board/meetings', 'POST', 'session=valid-token', {
        meetingDate: 'not-a-date',
        meetingType: 'regular',
      })
    )

    expect(response.status).toBe(400)
    expect(boardMocks.createBoardMeeting).not.toHaveBeenCalled()
  })

  it('creates a meeting and returns 201', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.createBoardMeeting.mockResolvedValue({ ...meeting, id: 'm-new' })

    const response = await postMeeting(
      buildRequest('http://localhost/api/board/meetings', 'POST', 'session=valid-token', {
        meetingDate: '2024-04-01',
        meetingType: 'regular',
        minutes: 'draft',
      })
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe('m-new')
    expect(boardMocks.createBoardMeeting).toHaveBeenCalledWith({
      companyId: 'company-1',
      meetingDate: expect.any(Date),
      meetingType: 'regular',
      minutes: 'draft',
    })
  })
})

describe('GET /api/board/meetings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the meeting does not exist', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue(null)

    const response = await getOne(
      buildRequest('http://localhost/api/board/meetings/m1', 'GET', 'session=valid-token'),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(404)
  })

  it('returns 403 when the meeting belongs to another company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue({ ...meeting, companyId: 'company-2' })

    const response = await getOne(
      buildRequest('http://localhost/api/board/meetings/m1', 'GET', 'session=valid-token'),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(403)
  })

  it('returns the meeting for the owning company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue(meeting)

    const response = await getOne(
      buildRequest('http://localhost/api/board/meetings/m1', 'GET', 'session=valid-token'),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(meeting)
    expect(boardMocks.getBoardMeetingById).toHaveBeenCalledWith('m1')
  })
})

describe('PUT /api/board/meetings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when the meeting does not exist or is foreign', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue(null)

    const response = await putMeeting(
      buildRequest('http://localhost/api/board/meetings/m1', 'PUT', 'session=valid-token', {
        status: 'COMPLETED',
      }),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(403)
    expect(boardMocks.updateBoardMeeting).not.toHaveBeenCalled()
  })

  it('updates the meeting for the owning company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue(meeting)
    boardMocks.updateBoardMeeting.mockResolvedValue({ ...meeting, meetingType: 'board' })

    const response = await putMeeting(
      buildRequest('http://localhost/api/board/meetings/m1', 'PUT', 'session=valid-token', {
        meetingType: 'board',
        status: 'COMPLETED',
      }),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(200)
    expect(boardMocks.updateBoardMeeting).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ meetingType: 'board', status: 'COMPLETED' })
    )
  })
})

describe('DELETE /api/board/meetings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when the meeting is foreign', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue({ ...meeting, companyId: 'company-2' })

    const response = await deleteMeeting(
      buildRequest('http://localhost/api/board/meetings/m1', 'DELETE', 'session=valid-token'),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(403)
    expect(boardMocks.deleteBoardMeeting).not.toHaveBeenCalled()
  })

  it('deletes the meeting for the owning company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    boardMocks.getBoardMeetingById.mockResolvedValue(meeting)
    boardMocks.deleteBoardMeeting.mockResolvedValue(undefined)

    const response = await deleteMeeting(
      buildRequest('http://localhost/api/board/meetings/m1', 'DELETE', 'session=valid-token'),
      { params: { id: 'm1' } }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true })
    expect(boardMocks.deleteBoardMeeting).toHaveBeenCalledWith('m1')
  })
})
