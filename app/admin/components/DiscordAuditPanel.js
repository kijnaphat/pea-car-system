'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

const categoryMeta = {
  vehicle: { label: 'รถ', icon: 'ph:car-profile-duotone', tone: 'bg-[#e9f8ef] text-[#1c7d45] border-[#c9ecd6]' },
  maintenance: { label: 'งานซ่อม', icon: 'ph:wrench-duotone', tone: 'bg-[#fff4df] text-[#a45d00] border-[#f5dbab]' },
  admin: { label: 'Admin', icon: 'ph:user-gear-duotone', tone: 'bg-[#f2e9f6] text-[#702082] border-[#dfcce6]' },
  document: { label: 'เอกสาร', icon: 'ph:signature-duotone', tone: 'bg-[#eaf2ff] text-[#2965ad] border-[#cbddf8]' },
  security: { label: 'ความปลอดภัย', icon: 'ph:shield-check-duotone', tone: 'bg-[#fff0ef] text-[#b93c34] border-[#f4d0cd]' },
  database: { label: 'Database', icon: 'ph:database-duotone', tone: 'bg-[#e9f2ff] text-[#345f9b] border-[#cfdef3]' },
  system: { label: 'ระบบ', icon: 'ph:gear-six-duotone', tone: 'bg-[#f1f1f3] text-[#5e5e68] border-[#dddde2]' },
}

const channelIcons = {
  all: 'ph:stack-duotone',
  car_out: 'ph:sign-out-duotone',
  car_return: 'ph:sign-in-duotone',
  ev: 'ph:lightning-duotone',
  maintenance: 'ph:wrench-duotone',
  mileage: 'ph:speedometer-duotone',
  admin: 'ph:user-gear-duotone',
  documents: 'ph:file-text-duotone',
  security: 'ph:shield-check-duotone',
  database: 'ph:database-duotone',
  system: 'ph:gear-six-duotone',
}

const deliveryMeta = {
  sending: { label: 'กำลังส่ง', icon: 'ph:spinner-gap-bold', style: 'text-[#2972b8]' },
  pending: { label: 'รอส่ง', icon: 'ph:clock-countdown-duotone', style: 'text-[#a45d00]' },
  failed: { label: 'ส่งไม่สำเร็จ', icon: 'ph:warning-circle-fill', style: 'text-[#d13f37]' },
  disabled: { label: 'เก็บในฐานข้อมูล', icon: 'ph:database-duotone', style: 'text-[#8c7b90]' },
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
  const [status, setStatus] = useState({ channels: [], totals: {} })
  const [events, setEvents] = useState([])
  const [webhookUrls, setWebhookUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [notice, setNotice] = useState(null)

  const channelNames = useMemo(() => Object.fromEntries(
    (status.channels || []).map(channel => [channel.channel_key, channel.channel_name])
  ), [status.channels])

  const refresh = useCallback(async () => {
    const [statusResult, eventsResult] = await Promise.all([
      supabase.rpc('get_discord_audit_channels_status'),
      supabase
        .from('audit_events')
        .select('id, occurred_at, category, event_type, title, description, actor_label, intended_channel_key, delivery_channel_key, delivery_status, last_error')
        .order('occurred_at', { ascending: false })
        .limit(40),
    ])

    if (statusResult.error) {
      setNotice({ type: 'error', text: statusResult.error.message })
    } else {
      setStatus(statusResult.data || { channels: [], totals: {} })
    }
    if (!eventsResult.error) setEvents(eventsResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(refresh, 0)
    const interval = window.setInterval(refresh, 15000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
    }
  }, [refresh])

  const saveWebhook = async (event, channel) => {
    event.preventDefault()
    const webhookUrl = webhookUrls[channel.channel_key]?.trim()
    if (!webhookUrl) return
    setWorking(`save:${channel.channel_key}`)
    setNotice(null)

    const { error: saveError } = await supabase.rpc('configure_discord_audit_channel', {
      p_channel_key: channel.channel_key,
      p_webhook_url: webhookUrl,
      p_enabled: true,
    })
    if (saveError) {
      setNotice({ type: 'error', text: saveError.message })
      setWorking('')
      return
    }

    setWebhookUrls(values => ({ ...values, [channel.channel_key]: '' }))
    const { error: testError } = await supabase.rpc('test_discord_audit_channel', {
      p_channel_key: channel.channel_key,
    })
    setNotice(testError
      ? { type: 'error', text: `บันทึก #${channel.channel_name} แล้ว แต่ส่งข้อความทดสอบไม่ได้: ${testError.message}` }
      : { type: 'success', text: `เชื่อมต่อและส่งข้อความทดสอบไปที่ #${channel.channel_name} แล้ว` })
    setWorking('')
    await refresh()
  }

  const toggleEnabled = async channel => {
    setWorking(`toggle:${channel.channel_key}`)
    setNotice(null)
    const nextEnabled = !channel.enabled
    const { error } = await supabase.rpc('set_discord_audit_channel_enabled', {
      p_channel_key: channel.channel_key,
      p_enabled: nextEnabled,
    })
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: `${nextEnabled ? 'เปิด' : 'ปิด'} #${channel.channel_name} แล้ว` })
    setWorking('')
    await refresh()
  }

  const sendTest = async channel => {
    setWorking(`test:${channel.channel_key}`)
    setNotice(null)
    const { error } = await supabase.rpc('test_discord_audit_channel', {
      p_channel_key: channel.channel_key,
    })
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: `ส่งข้อความทดสอบไปที่ #${channel.channel_name} แล้ว` })
    setWorking('')
    await refresh()
  }

  const retryFailed = async channelKey => {
    setWorking(`retry:${channelKey || 'all'}`)
    setNotice(null)
    const { data, error } = await supabase.rpc('retry_failed_discord_audits_for_channel', {
      p_channel_key: channelKey || null,
    })
    setNotice(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: `นำ ${data?.queued_count || 0} รายการกลับเข้าคิวส่งแล้ว` })
    setWorking('')
    await refresh()
  }

  if (loading) {
    return <div className="rounded-[22px] border border-[#eadfed] bg-white p-8 text-center text-[13px] text-[#765c7c]"><Icon icon="ph:spinner-gap-bold" width="26" height="26" className="mx-auto mb-3 animate-spin text-[#702082]" />กำลังโหลด Discord Log Channels...</div>
  }

  const totals = status.totals || {}
  const configuredCount = (status.channels || []).filter(channel => channel.configured).length
  const enabledCount = (status.channels || []).filter(channel => channel.enabled).length

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-[#d9c6df] bg-gradient-to-br from-[#32103d] via-[#4c165b] to-[#702082] text-white shadow-[0_18px_45px_rgba(75,21,96,.2)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#ffe86a]"><Icon icon="ph:discord-logo-fill" width="17" height="17" /> Multi-channel Audit Center</span>
            <h2 className="mt-5 text-[25px] font-bold tracking-tight sm:text-[31px]">แยก Log ทุกความเคลื่อนไหวตาม Channel</h2>
            <p className="mt-3 max-w-xl text-[13px] leading-6 text-white/70">เหตุการณ์สำคัญจะไปห้องเฉพาะของตัวเอง และทุก INSERT / UPDATE / DELETE จะถูกบันทึกซ้ำใน #log-database-changes พร้อมข้อมูลก่อน–หลังที่ตัดข้อมูลลับแล้ว</p>
            <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-semibold text-white/75">
              <span className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5">{configuredCount}/{status.channels?.length || 0} Channels ตั้งค่าแล้ว</span>
              <span className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5">{enabledCount} Channels เปิดใช้งาน</span>
              <span className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5">คงเหลือในคิว {totals.stored_count || 0} เหตุการณ์</span>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/12 bg-black/15 p-5 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/50">Delivery Overview</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">ในฐานข้อมูล</p><p className="mt-1 text-[20px] font-bold">{totals.stored_count || 0}</p></div>
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">รอส่ง</p><p className="mt-1 text-[20px] font-bold text-[#ffe86a]">{totals.pending_count || 0}</p></div>
              <div className="rounded-[14px] bg-white/[.08] p-3"><p className="text-[9px] text-white/50">ผิดพลาด</p><p className="mt-1 text-[20px] font-bold text-[#ff8e88]">{totals.failed_count || 0}</p></div>
            </div>
            <button type="button" onClick={() => retryFailed(null)} disabled={Boolean(working) || !totals.failed_count} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-white/[.08] py-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Icon icon={working === 'retry:all' ? 'ph:spinner-gap-bold' : 'ph:arrows-clockwise-bold'} width="16" height="16" className={working === 'retry:all' ? 'animate-spin' : ''} />ส่งรายการผิดพลาดทั้งหมดซ้ำ</button>
          </div>
        </div>
      </section>

      {notice && <div className={`flex items-start gap-2.5 rounded-[16px] border px-4 py-3.5 text-[12px] ${notice.type === 'error' ? 'border-[#ffd0cd] bg-[#fff0ef] text-[#b93c34]' : 'border-[#c9ecd6] bg-[#edf9f1] text-[#1c7d45]'}`}><Icon icon={notice.type === 'error' ? 'ph:warning-circle-fill' : 'ph:check-circle-fill'} width="19" height="19" className="shrink-0" /><span>{notice.text}</span></div>}

      <section className="rounded-[22px] border border-[#eadfed] bg-white p-5 shadow-[0_10px_30px_rgba(75,21,96,.06)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fff7c7] text-[#806400]"><Icon icon="ph:list-numbers-duotone" width="25" height="25" /></span>
          <div><h3 className="text-[15px] font-bold text-[#4b1560]">ตั้งค่า Discord ครั้งเดียว</h3><p className="mt-1 text-[11px] leading-5 text-[#765c7c]">สร้าง Text Channel ตามชื่อด้านล่าง → เปิด Edit Channel → Integrations → Webhooks → New Webhook → Copy URL แล้วนำมาใส่ในช่องของห้องนั้น</p></div>
        </div>
        <div className="mt-4 rounded-[14px] border border-[#dce8f7] bg-[#f3f8ff] px-4 py-3 text-[10px] leading-5 text-[#466684]"><Icon icon="ph:info-duotone" width="17" height="17" className="mr-1.5 inline text-[#3a78b8]" />หากยังไม่ได้ตั้งห้องเฉพาะ เหตุการณ์จะส่งไป <strong>#log-all</strong> แทนถ้าห้องรวมเปิดอยู่ เมื่อ Discord ยืนยันรับสำเร็จ ระบบจะลบรายการนั้นจาก Supabase อัตโนมัติ ส่วนรายการส่งไม่ผ่านจะเก็บไว้เพื่อส่งซ้ำ</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {(status.channels || []).map(channel => {
          const saveKey = `save:${channel.channel_key}`
          const testKey = `test:${channel.channel_key}`
          const toggleKey = `toggle:${channel.channel_key}`
          const retryKey = `retry:${channel.channel_key}`
          return <form key={channel.channel_key} onSubmit={event => saveWebhook(event, channel)} className={`rounded-[22px] border bg-white p-5 shadow-[0_8px_25px_rgba(75,21,96,.05)] ${channel.enabled ? 'border-[#d7c2de]' : 'border-[#eadfed]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${channel.enabled ? 'bg-[#702082] text-white' : 'bg-[#f1e6f4] text-[#8b6f92]'}`}><Icon icon={channelIcons[channel.channel_key] || 'ph:hash-duotone'} width="24" height="24" /></span>
                <div className="min-w-0"><h3 className="truncate text-[14px] font-bold text-[#4b1560]">#{channel.channel_name}</h3><p className="mt-0.5 text-[10px] font-semibold text-[#8b3c98]">{channel.display_name}</p><p className="mt-1 text-[10px] leading-4 text-[#8b7a8f]">{channel.description}</p></div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${channel.enabled ? 'bg-[#e5f7eb] text-[#237747]' : channel.configured ? 'bg-[#fff4df] text-[#966000]' : 'bg-[#f1eef2] text-[#817184]'}`}>{channel.enabled ? 'เปิดใช้งาน' : channel.configured ? 'ปิดอยู่' : 'ยังไม่ตั้งค่า'}</span>
            </div>

            <div className="relative mt-4">
              <Icon icon="ph:link-simple-bold" width="18" height="18" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b3c98]" />
              <input type="password" autoComplete="off" value={webhookUrls[channel.channel_key] || ''} onChange={event => setWebhookUrls(values => ({ ...values, [channel.channel_key]: event.target.value }))} required placeholder={channel.configured ? 'ใส่ URL ใหม่เมื่อต้องการเปลี่ยน Webhook' : `Webhook URL ของ #${channel.channel_name}`} className="w-full rounded-[13px] border border-[#dfcfe4] bg-[#fcf9fd] py-3 pl-10 pr-3 text-[11px] text-[#35133f] outline-none placeholder:text-[#b4a4b8] focus:border-[#702082] focus:ring-3 focus:ring-[#702082]/10" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="submit" disabled={Boolean(working) || !webhookUrls[channel.channel_key]?.trim()} className="flex items-center justify-center gap-1.5 rounded-[11px] bg-[#702082] px-3 py-2.5 text-[9px] font-bold text-white disabled:opacity-40"><Icon icon={working === saveKey ? 'ph:spinner-gap-bold' : 'ph:floppy-disk-back-duotone'} width="15" height="15" className={working === saveKey ? 'animate-spin' : ''} />{channel.configured ? 'เปลี่ยน URL' : 'บันทึก'}</button>
              <button type="button" onClick={() => sendTest(channel)} disabled={Boolean(working) || !channel.enabled} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-[#dfcfe4] bg-[#faf7fb] px-3 py-2.5 text-[9px] font-bold text-[#604568] disabled:opacity-40"><Icon icon={working === testKey ? 'ph:spinner-gap-bold' : 'ph:paper-plane-tilt-duotone'} width="15" height="15" className={working === testKey ? 'animate-spin' : ''} />ทดสอบ</button>
              <button type="button" onClick={() => toggleEnabled(channel)} disabled={Boolean(working) || !channel.configured} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-[#dfcfe4] bg-white px-3 py-2.5 text-[9px] font-bold text-[#604568] disabled:opacity-40"><Icon icon={working === toggleKey ? 'ph:spinner-gap-bold' : channel.enabled ? 'ph:pause-circle-duotone' : 'ph:play-circle-duotone'} width="15" height="15" className={working === toggleKey ? 'animate-spin' : ''} />{channel.enabled ? 'ปิด' : 'เปิด'}</button>
              <button type="button" onClick={() => retryFailed(channel.channel_key)} disabled={Boolean(working) || !channel.failed_count} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-[#f0d7d4] bg-[#fff7f6] px-3 py-2.5 text-[9px] font-bold text-[#a13d37] disabled:opacity-40"><Icon icon={working === retryKey ? 'ph:spinner-gap-bold' : 'ph:arrows-clockwise-bold'} width="15" height="15" className={working === retryKey ? 'animate-spin' : ''} />ซ้ำ {channel.failed_count || 0}</button>
            </div>

            <div className="mt-3 flex items-center gap-3 border-t border-[#f0e8f2] pt-3 text-[8px] font-semibold text-[#99899d]"><span>รอส่ง {channel.pending_count || 0}</span><span>ผิดพลาด {channel.failed_count || 0}</span><span>ส่งสำเร็จแล้วลบอัตโนมัติ</span></div>
          </form>
        })}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#eadfed] bg-white shadow-[0_10px_30px_rgba(75,21,96,.06)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eadfed] px-5 py-4 sm:px-6"><div><h3 className="text-[15px] font-bold text-[#4b1560]">คิว Audit Log ล่าสุด</h3><p className="mt-0.5 text-[10px] text-[#846c89]">แสดงเฉพาะรายการรอส่ง ปิดอยู่ หรือส่งไม่สำเร็จ รายการที่ Discord รับแล้วจะถูกลบ</p></div><button type="button" onClick={refresh} className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#dfcfe4] bg-[#faf7fb] text-[#702082]" aria-label="รีเฟรช"><Icon icon="ph:arrows-clockwise-bold" width="17" height="17" /></button></div>
        <div className="divide-y divide-[#f0e8f2]">
          {events.length === 0 ? <div className="px-6 py-12 text-center text-[12px] text-[#8b7a8f]">ส่งเข้า Discord ครบแล้ว ไม่มีรายการค้าง</div> : events.map(item => {
            const category = categoryMeta[item.category] || categoryMeta.system
            const delivery = deliveryMeta[item.delivery_status] || deliveryMeta.disabled
            const intendedName = channelNames[item.intended_channel_key] || item.intended_channel_key
            const deliveryName = channelNames[item.delivery_channel_key] || item.delivery_channel_key
            return <article key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:px-6">
              <span className={`flex h-10 w-10 items-center justify-center rounded-[13px] border ${category.tone}`}><Icon icon={category.icon} width="21" height="21" /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-[13px] font-bold text-[#4b1560]">{item.title}</h4><span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${category.tone}`}>{category.label}</span></div><p className="mt-1 text-[11px] leading-5 text-[#765c7c]">{item.description || item.event_type}</p><p className="mt-1.5 text-[9px] text-[#a08fa4]">{formatDateTime(item.occurred_at)} · {item.actor_label || 'ผู้ใช้งานเว็บไซต์'} · #{intendedName || 'system'}{deliveryName && deliveryName !== intendedName ? ` → #${deliveryName}` : ''}</p>{item.last_error && <p className="mt-2 rounded-[9px] bg-[#fff0ef] px-2.5 py-1.5 text-[9px] text-[#b93c34]">{item.last_error}</p>}</div>
              <span className={`flex items-center gap-1.5 text-[9px] font-bold ${delivery.style}`}><Icon icon={delivery.icon} width="15" height="15" className={item.delivery_status === 'sending' ? 'animate-spin' : ''} />{delivery.label}</span>
            </article>
          })}
        </div>
      </section>

      <div className="rounded-[14px] border border-[#e5d9e8] bg-[#faf7fb] px-4 py-3 text-[10px] leading-5 text-[#7d6a82]"><Icon icon="ph:lock-key-duotone" width="17" height="17" className="mr-1.5 inline text-[#702082]" />Webhook ทุกห้องเก็บแบบเข้ารหัสใน Supabase Vault ระบบไม่แสดง URL เดิมกลับมา และไม่บันทึกรหัสผ่าน, Token, เบอร์โทร, อีเมลพนักงาน หรือภาพลายเซ็นลง Log</div>
    </div>
  )
}
