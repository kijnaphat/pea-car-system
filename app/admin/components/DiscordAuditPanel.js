'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

const categoryMeta = {
  vehicle: { label: 'รถออก–คืน / EV', icon: 'ph:car-profile-duotone', tone: 'bg-[#e9f8ef] text-[#1c7d45] border-[#c9ecd6]' },
  maintenance: { label: 'งานซ่อม', icon: 'ph:wrench-duotone', tone: 'bg-[#fff4df] text-[#a45d00] border-[#f5dbab]' },
  admin: { label: 'Admin', icon: 'ph:user-gear-duotone', tone: 'bg-[#f2e9f6] text-[#702082] border-[#dfcce6]' },
  document: { label: 'เอกสาร', icon: 'ph:signature-duotone', tone: 'bg-[#eaf2ff] text-[#2965ad] border-[#cbddf8]' },
  security: { label: 'ความปลอดภัย', icon: 'ph:shield-check-duotone', tone: 'bg-[#fff0ef] text-[#b93c34] border-[#f4d0cd]' },
  system: { label: 'ระบบ', icon: 'ph:gear-six-duotone', tone: 'bg-[#f1f1f3] text-[#5e5e68] border-[#ddddE2]' },
}

const deliveryMeta = {
  delivered: { label: 'ส่งแล้ว', icon: 'ph:check-circle-fill', style: 'text-[#23834c]' },
  sending: { label: 'กำลังส่ง', icon: 'ph:spinner-gap-bold', style: 'text-[#2972b8]' },
  pending: { label: 'รอส่ง', icon: 'ph:clock-countdown-duotone', style: 'text-[#a45d00]' },
  failed: { label: 'ส่งไม่สำเร็จ', icon: 'ph:warning-circle-fill', style: 'text-[#d13f37]' },
  disabled: { label: 'ไม่ได้ส่ง', icon: 'ph:minus-circle-duotone', style: 'text-[#8c7b90]' },
}

const formatDateTime = value => {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export default function DiscordAuditPanel() {
  const [status, setStatus] = useState(null)
  const [events, setEvents] = useState([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [notice, setNotice] = useState(null)

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    const [statusResult, eventsResult] = await Promise.all([
      supabase.rpc('get_discord_audit_status'),
      supabase
        .from('audit_events')
        .select('id, occurred_at, category, event_type, title, description, actor_label, delivery_status, last_error')
        .order('occurred_at', { ascending: false })
        .limit(30),
    ])

    if (statusResult.error) {
      setNotice({ type: 'error', text: statusResult.error.message })
    } else {
      setStatus(statusResult.data || {})
    }
    if (!eventsResult.error) setEvents(eventsResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => refresh(false), 0)
    const interval = window.setInterval(() => refresh(false), 15000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
    }
  }, [refresh])

  const saveWebhook = async event => {
    event.preventDefault()
    if (!webhookUrl.trim()) return
    setWorking('save')
    setNotice(null)
    const { error: saveError } = await supabase.rpc('configure_discord_audit_webhook', {
      p_webhook_url: webhookUrl.trim(),
      p_enabled: true,
    })
    if (saveError) {
      setNotice({ type: 'error', text: saveError.message })
      setWorking('')
      return
    }

    setWebhookUrl('')
    const { error: testError } = await supabase.rpc('test_discord_audit_webhook')
    setNotice(testError
      ? { type: 'error', text: `บันทึก Webhook แล้ว แต่ส่งข้อความทดสอบไม่ได้: ${testError.message}` }
      : { type: 'success', text: 'บันทึก Webhook และส่งข้อความทดสอบแล้ว กรุณาตรวจช่อง Discord' })
    setWorking('')
    await refresh(false)
  }

  const toggleEnabled = async () => {
    setWorking('toggle')
    setNotice(null)
    const nextEnabled = !status?.enabled
    const { error } = await supabase.rpc('set_discord_audit_enabled', { p_enabled: nextEnabled })
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: nextEnabled ? 'เปิดส่ง Discord Log แล้ว' : 'หยุดส่ง Discord Log ชั่วคราวแล้ว' })
    setWorking('')
    await refresh(false)
  }

  const sendTest = async () => {
    setWorking('test')
    setNotice(null)
    const { error } = await supabase.rpc('test_discord_audit_webhook')
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'ส่งข้อความทดสอบแล้ว กรุณาตรวจช่อง Discord' })
    setWorking('')
    await refresh(false)
  }

  const retryFailed = async () => {
    setWorking('retry')
    setNotice(null)
    const { data, error } = await supabase.rpc('retry_failed_discord_audits')
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: `นำ ${data?.queued_count || 0} รายการกลับเข้าคิวส่งแล้ว` })
    setWorking('')
    await refresh(false)
  }

  if (loading) {
    return <div className="rounded-[22px] border border-[#eadfed] bg-white p-8 text-center text-[13px] text-[#765c7c]"><Icon icon="ph:spinner-gap-bold" width="26" height="26" className="mx-auto mb-3 animate-spin text-[#702082]" />กำลังโหลดสถานะ Discord Log...</div>
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-[#d9c6df] bg-gradient-to-br from-[#32103d] via-[#4c165b] to-[#702082] text-white shadow-[0_18px_45px_rgba(75,21,96,.2)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#ffe86a]"><Icon icon="ph:discord-logo-fill" width="17" height="17" /> Discord Audit Log</span>
            <h2 className="mt-5 text-[25px] font-bold tracking-tight sm:text-[31px]">บันทึกเหตุการณ์สำคัญของเว็บแบบอัตโนมัติ</h2>
            <p className="mt-3 max-w-xl text-[13px] leading-6 text-white/70">ครอบคลุมรถออก–คืนรถ, ชาร์จ EV, งานซ่อม, แก้เลขไมล์, ลายเซ็นเอกสาร, การเปลี่ยนข้อมูลโดย Admin และการเข้า–ออกระบบ</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(categoryMeta).slice(0, 5).map(([key, meta]) => <span key={key} className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-[10px] font-semibold text-white/80">{meta.label}</span>)}
            </div>
          </div>

          <div className="rounded-[20px] border border-white/12 bg-black/15 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/50">Connection</p>
                <p className="mt-2 flex items-center gap-2 text-[15px] font-bold"><span className={`h-2.5 w-2.5 rounded-full ${status?.enabled ? 'bg-[#4ee58a] shadow-[0_0_12px_#4ee58a]' : 'bg-white/30'}`} />{status?.configured ? status?.enabled ? 'เชื่อมต่อและเปิดใช้งาน' : 'ตั้งค่าแล้ว · ปิดชั่วคราว' : 'ยังไม่ได้ตั้งค่า'}</p>
              </div>
              {status?.configured && <button type="button" onClick={toggleEnabled} disabled={Boolean(working)} className={`rounded-[12px] px-4 py-2.5 text-[11px] font-bold transition-all disabled:opacity-50 ${status?.enabled ? 'border border-white/15 bg-white/10 text-white hover:bg-white/15' : 'bg-[#ffdd00] text-[#35133f]'}`}>{working === 'toggle' ? 'กำลังบันทึก...' : status?.enabled ? 'หยุดส่งชั่วคราว' : 'เปิดใช้งาน'}</button>}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">ส่งแล้ว</p><p className="mt-1 text-[20px] font-bold">{status?.delivered_count || 0}</p></div>
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">รอส่ง</p><p className="mt-1 text-[20px] font-bold text-[#ffe86a]">{status?.pending_count || 0}</p></div>
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">ผิดพลาด</p><p className="mt-1 text-[20px] font-bold text-[#ff8e88]">{status?.failed_count || 0}</p></div>
            </div>
          </div>
        </div>
      </section>

      {notice && <div className={`flex items-start gap-2.5 rounded-[16px] border px-4 py-3.5 text-[12px] ${notice.type === 'error' ? 'border-[#ffd0cd] bg-[#fff0ef] text-[#b93c34]' : 'border-[#c9ecd6] bg-[#edf9f1] text-[#1c7d45]'}`}><Icon icon={notice.type === 'error' ? 'ph:warning-circle-fill' : 'ph:check-circle-fill'} width="19" height="19" className="shrink-0" /><span>{notice.text}</span></div>}

      <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <form onSubmit={saveWebhook} className="rounded-[22px] border border-[#eadfed] bg-white p-6 shadow-[0_10px_30px_rgba(75,21,96,.06)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#f1e6f4] text-[#702082]"><Icon icon="ph:webhooks-logo-duotone" width="25" height="25" /></span>
            <div><h3 className="text-[16px] font-bold text-[#4b1560]">Discord Webhook</h3><p className="mt-0.5 text-[10px] text-[#846c89]">เก็บแบบเข้ารหัสใน Supabase Vault</p></div>
          </div>
          <label className="mt-5 block">
            <span className="text-[11px] font-bold text-[#604568]">{status?.configured ? 'ใส่ URL ใหม่เมื่อต้องการเปลี่ยนช่อง' : 'วาง Webhook URL จากช่อง Discord'}</span>
            <div className="relative mt-2">
              <Icon icon="ph:link-simple-bold" width="19" height="19" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b3c98]" />
              <input type="password" autoComplete="off" value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} required placeholder="https://discord.com/api/webhooks/..." className="w-full rounded-[14px] border border-[#dfcfe4] bg-[#fcf9fd] py-3.5 pl-11 pr-4 text-[13px] text-[#35133f] outline-none placeholder:text-[#b4a4b8] focus:border-[#702082] focus:ring-3 focus:ring-[#702082]/10" />
            </div>
          </label>
          <button type="submit" disabled={Boolean(working) || !webhookUrl.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#702082] py-3.5 text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(112,32,130,.2)] disabled:cursor-not-allowed disabled:opacity-45"><Icon icon={working === 'save' ? 'ph:spinner-gap-bold' : 'ph:floppy-disk-back-duotone'} width="18" height="18" className={working === 'save' ? 'animate-spin' : ''} />{working === 'save' ? 'กำลังบันทึกและทดสอบ...' : status?.configured ? 'เปลี่ยน Webhook และทดสอบ' : 'บันทึก Webhook และทดสอบ'}</button>
          <p className="mt-3 text-[10px] leading-5 text-[#8b7a8f]">ระบบจะไม่แสดง Webhook URL เดิมกลับมาที่หน้าเว็บ และจะไม่ส่งรหัสผ่าน, Token, เบอร์โทร หรือภาพลายเซ็นไป Discord</p>
        </form>

        <div className="rounded-[22px] border border-[#eadfed] bg-white p-6 shadow-[0_10px_30px_rgba(75,21,96,.06)]">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff7c7] text-[#806400]"><Icon icon="ph:pulse-duotone" width="25" height="25" /></span><div><h3 className="text-[16px] font-bold text-[#4b1560]">ตรวจสอบการส่ง</h3><p className="mt-0.5 text-[10px] text-[#846c89]">คิวส่งซ้ำอัตโนมัติทุก 1 นาที</p></div></div>
          <div className="mt-5 space-y-2.5">
            <button type="button" onClick={sendTest} disabled={Boolean(working) || !status?.enabled} className="flex w-full items-center justify-between rounded-[14px] border border-[#dfcfe4] bg-[#faf7fb] px-4 py-3.5 text-left text-[12px] font-bold text-[#604568] disabled:opacity-45"><span className="flex items-center gap-2"><Icon icon={working === 'test' ? 'ph:spinner-gap-bold' : 'ph:paper-plane-tilt-duotone'} width="19" height="19" className={working === 'test' ? 'animate-spin text-[#702082]' : 'text-[#702082]'} />ส่งข้อความทดสอบ</span><Icon icon="ph:caret-right-bold" width="15" height="15" /></button>
            <button type="button" onClick={retryFailed} disabled={Boolean(working) || !status?.failed_count} className="flex w-full items-center justify-between rounded-[14px] border border-[#f0d7d4] bg-[#fff7f6] px-4 py-3.5 text-left text-[12px] font-bold text-[#a13d37] disabled:opacity-45"><span className="flex items-center gap-2"><Icon icon={working === 'retry' ? 'ph:spinner-gap-bold' : 'ph:arrows-clockwise-bold'} width="19" height="19" className={working === 'retry' ? 'animate-spin' : ''} />ส่งรายการที่ผิดพลาดซ้ำ</span><span className="rounded-full bg-[#ffe5e2] px-2 py-0.5 text-[9px]">{status?.failed_count || 0}</span></button>
          </div>
          <div className="mt-4 rounded-[14px] bg-[#f4f7fb] px-4 py-3 text-[10px] leading-5 text-[#657184]"><Icon icon="ph:info-duotone" width="17" height="17" className="mr-1.5 inline text-[#3a78b8]" />Discord ขัดข้องหรือจำกัดความถี่ ระบบจะเก็บ Log ไว้ในฐานข้อมูลและลองส่งซ้ำสูงสุด 5 ครั้ง</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#eadfed] bg-white shadow-[0_10px_30px_rgba(75,21,96,.06)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eadfed] px-5 py-4 sm:px-6"><div><h3 className="text-[15px] font-bold text-[#4b1560]">ประวัติ Audit Log ล่าสุด</h3><p className="mt-0.5 text-[10px] text-[#846c89]">ข้อมูลต้นฉบับยังอยู่ที่นี่ แม้ Discord ส่งไม่สำเร็จ</p></div><button type="button" onClick={() => refresh(false)} className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#dfcfe4] bg-[#faf7fb] text-[#702082]" aria-label="รีเฟรช"><Icon icon="ph:arrows-clockwise-bold" width="17" height="17" /></button></div>
        <div className="divide-y divide-[#f0e8f2]">
          {events.length === 0 ? <div className="px-6 py-12 text-center text-[12px] text-[#8b7a8f]">ยังไม่มี Audit Log ใหม่หลังติดตั้งระบบ</div> : events.map(item => {
            const category = categoryMeta[item.category] || categoryMeta.system
            const delivery = deliveryMeta[item.delivery_status] || deliveryMeta.disabled
            return <article key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:px-6">
              <span className={`flex h-10 w-10 items-center justify-center rounded-[13px] border ${category.tone}`}><Icon icon={category.icon} width="21" height="21" /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-[13px] font-bold text-[#4b1560]">{item.title}</h4><span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${category.tone}`}>{category.label}</span></div><p className="mt-1 text-[11px] leading-5 text-[#765c7c]">{item.description || item.event_type}</p><p className="mt-1.5 text-[9px] text-[#a08fa4]">{formatDateTime(item.occurred_at)} · {item.actor_label || 'ผู้ใช้งานเว็บไซต์'}</p>{item.last_error && <p className="mt-2 rounded-[9px] bg-[#fff0ef] px-2.5 py-1.5 text-[9px] text-[#b93c34]">{item.last_error}</p>}</div>
              <span className={`flex items-center gap-1.5 text-[9px] font-bold ${delivery.style}`}><Icon icon={delivery.icon} width="15" height="15" className={item.delivery_status === 'sending' ? 'animate-spin' : ''} />{delivery.label}</span>
            </article>
          })}
        </div>
      </section>
    </div>
  )
}
