import { Resend } from 'resend'
import { speciesIcon } from './speciesIcon'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'KiVital <onboarding@resend.dev>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ki-vital.vercel.app'

type UnloggedPet = {
  name: string
  species: string
  daysSince: number
  petId: string
}

export async function sendLogReminder(toEmail: string, pets: UnloggedPet[]) {
  const petLines = pets.map(p => {
    const emoji = speciesIcon(p.species)
    const days = p.daysSince === 1 ? '1 day' : `${p.daysSince} days`
    return `<li style="margin-bottom:8px">${emoji} <strong>${p.name}</strong> — last logged ${days} ago</li>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">

    <div style="background:#059669;padding:24px 32px">
      <p style="color:#fff;font-size:22px;font-weight:700;margin:0">KiVital 🐾</p>
      <p style="color:#a7f3d0;font-size:14px;margin:4px 0 0">Smart Health for Your Pets</p>
    </div>

    <div style="padding:32px">
      <p style="font-size:16px;color:#111827;margin:0 0 8px">Hi there 👋</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
        The following pet${pets.length > 1 ? 's' : ''} haven't been logged recently.
        A quick daily log helps track their health trends and improves AI report accuracy.
      </p>

      <ul style="padding:0;list-style:none;margin:0 0 24px;background:#f9fafb;border-radius:12px;padding:16px 20px">
        ${petLines}
      </ul>

      <a href="${BASE_URL}/log"
         style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px">
        + Log Health Now
      </a>

      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0">
        You're receiving this because you have an account on KiVital.<br>
        <a href="${BASE_URL}" style="color:#9ca3af">Visit KiVital</a>
      </p>
    </div>
  </div>
</body>
</html>`

  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: pets.length === 1
      ? `${pets[0].name} hasn't been logged in ${pets[0].daysSince} day${pets[0].daysSince > 1 ? 's' : ''} 🐾`
      : `${pets.length} pets need a health log today 🐾`,
    html,
  })
}
