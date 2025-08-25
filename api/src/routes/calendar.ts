import { Router, Request, Response, NextFunction } from 'express'
import { google } from 'googleapis'

const router = Router()

router.post('/create', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      res.status(401).json({ success: false, error: 'Missing bearer access token' })
      return
    }

    const { title, description, startDateTime, endDateTime, location, attendees } = req.body || {}
    if (!title || !startDateTime || !endDateTime) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: token })
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })

    const event = {
      summary: title,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      location,
      attendees: Array.isArray(attendees) ? attendees.map((e: string) => ({ email: e })) : undefined,
    } as any

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    res.json({ success: true, data: { id: response.data.id, htmlLink: response.data.htmlLink } })
    return
  } catch (error) {
    next(error)
    return
  }
})

export default router