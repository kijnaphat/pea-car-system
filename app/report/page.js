'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams } from 'next/navigation'

function ReportPage() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id')
  
  const [car, setCar] = useState(null)
  const [logs, setLogs] = useState([])

  const fetchData = async () => {
    if (!carId) return
    const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
    setCar(c)
    const { data: l } = await supabase.from('trip_logs')
      .select('*')
      .eq('car_id', carId)
      .eq('is_completed', true)
      .order('created_at', { ascending: true })
    setLogs(l || [])
  }

  useEffect(() => {
    if (carId) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''
  
  // ✅ ปรับแก้ตรงนี้: เปลี่ยนจาก 15 เป็น 11 ตามที่ต้องการ
  const emptyRows = Array.from({ length: Math.max(0, 11 - logs.length) }) 

  return (
    <div className="min-h-screen bg-gray-500 p-8 flex justify-center items-start print:bg-white print:p-0 font-sarabun text-black">
      {/* ปุ่มพิมพ์เอกสาร */}
      <div className="fixed top-4 right-4 no-print z-50">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold">
          🖨️ พิมพ์เอกสาร (แนวนอน)
        </button>
      </div>

      {/* กระดาษ A4 แนวนอน */}
      <div className="bg-white w-[297mm] min-h-[210mm] p-[5mm] relative shadow-xl print:shadow-none box-border flex flex-col">
        
        {/* หัวกระดาษ */}
        <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col items-center w-[280px]">
                <img src="/pea_logo.png" alt="PEA Logo" className="h-14 mb-1 object-contain" />
                <div className="text-[16px] font-bold leading-tight">การไฟฟ้าส่วนภูมิภาค</div>
                <div className="text-[9px] text-gray-600 uppercase leading-none tracking-tighter">Provincial Electricity Authority</div>
            </div>
            
            <div className="text-center flex-grow pb-[2px]">
                <div className="text-[14px]">การไฟฟ้าส่วนภูมิภาค</div>
                <div className="text-[16px] mt-1 font-bold">แบบฟอร์มรายงานการใช้ยานพาหนะหรือเครื่องจักร</div>
            </div>
            
            <div className="w-[280px] text-right text-[13px] pb-[2px]">หน้าที่ ...............</div>
        </div>

        {/* ข้อมูลรายงาน */}
        <div className="text-[13px] space-y-1 mt-2 font-normal">
            <div className="grid grid-cols-3 w-full items-center">
                <div className="flex items-center pl-2">จาก <span className="border-b border-dotted border-black w-[150px] ml-1"></span></div>
                <div className="flex items-center justify-center whitespace-nowrap">ถึง (หัวหน้าหน่วยงาน) <span className="border-b border-dotted border-black w-[150px] ml-1"></span></div>
                <div></div>
            </div>
            <div className="grid grid-cols-3 w-full items-center">
                <div className="flex items-center pl-2">เรื่อง <span className="ml-1 font-bold">รายงานการใช้ยานพาหนะหรือเครื่องจักร</span></div>
                <div className="flex items-center justify-center whitespace-nowrap">
                    วันที่ <span className="border-b border-dotted border-black w-8 text-center mx-1">{new Date().getDate()}</span>
                    เดือน <span className="border-b border-dotted border-black w-24 text-center mx-1">{new Date().toLocaleDateString('th-TH', { month: 'long' })}</span>
                    ปี <span className="border-b border-dotted border-black w-16 text-center mx-1">{new Date().getFullYear() + 543}</span>
                </div>
                <div></div>
            </div>
            <div className="flex items-center pl-2">เรียน หัวหน้าหน่วยงาน <span className="border-b border-dotted border-black w-[180px] ml-1"></span></div>
            <div className="flex flex-wrap pt-1 items-end leading-relaxed pl-2">
                รายงานการใช้ยานพาหนะ ประจำเดือน <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1">{new Date().toLocaleDateString('th-TH', { month: 'long' })}</span>
                พ.ศ. <span className="border-b border-dotted border-black min-w-[50px] text-center mx-1">{new Date().getFullYear() + 543}</span>
                หมายเลขทะเบียน <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-bold">{car?.plate_number}</span>
                รหัส <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span>
                ประเภท <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.car_type}</span>
                ชนิด <span className="border-b border-dotted border-black flex-grow text-center mx-1 font-normal">{car?.model}</span>
            </div>
            <div className="flex items-center gap-3 pt-1 text-[12px] pl-2">
                <span>ชนิดเชื้อเพลิง</span>
                {['แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ E20', 'แก๊สโซฮอล์ E85', 'ดีเซล'].map(f => (
                    <div key={f} className="flex items-center gap-1 font-normal">
                        <div className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[11px] relative">
                             {car?.fuel_type === f && <span className="absolute -top-1 font-bold">✓</span>}
                        </div> <span>{f}</span>
                    </div>
                ))}
                <span className="ml-2 font-normal">น้ำมันหล่อลื่น จำนวน ................. ลิตร</span>
            </div>
        </div>

        {/* ตารางข้อมูล */}
        <table className="w-full border-collapse border border-black mt-2 text-[12px]">
          <thead>
            <tr className="text-center h-[45px] bg-gray-50 print:bg-transparent">
              <th className="border border-black w-[10%] font-bold">วันที่</th>
              <th className="border border-black w-[14%] font-bold px-1">ชื่อ-ตำแหน่ง / หน่วยงานที่ใช้</th>
              <th className="border border-black w-[14%] font-bold px-1">สถานที่ปฏิบัติงาน</th>
              <th className="border border-black w-[12%] p-0 font-bold">
                <div className="h-[22px] flex items-center justify-center border-b border-black text-[11px]">เลขระยะทาง</div>
                <div className="h-[23px] flex divide-x divide-black text-[11px]">
                    <div className="w-1/2 flex items-center justify-center text-[10px]">ไป</div>
                    <div className="w-1/2 flex items-center justify-center text-[10px]">กลับ</div>
                </div>
              </th>
              <th className="border border-black w-[7%] font-bold text-[10px]">ชั่วโมงการ<br/>ทำงาน</th>
              <th className="border border-black w-[8%] font-bold text-[10px]">น้ำมันที่เติม<br/>(ลิตร)</th>
              <th className="border border-black w-[8%] font-bold text-[10px]">จำนวนเงิน<br/>(บาท)</th>
              <th className="border border-black w-[11%] font-bold text-[11px]">รายการซ่อม</th>
              <th className="border border-black w-[8%] font-bold text-[10px]">ค่าซ่อม (บาท)</th>
              <th className="border border-black w-[8%] font-bold text-[11px]">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} className="h-[28px] align-middle font-normal">
                <td className="border border-black text-center">{formatDate(log.created_at)}</td>
                <td className="border border-black px-1 text-center truncate max-w-[120px]">{log.driver_name}</td>
                <td className="border border-black px-1 text-center truncate max-w-[120px]">{log.location}</td>
                <td className="border border-black p-0 h-full font-normal">
                    <div className="flex divide-x divide-black h-[28px]">
                      <div className="w-1/2 flex items-center justify-center">{log.start_mileage}</div>
                      <div className="w-1/2 flex items-center justify-center">{log.end_mileage}</div>
                    </div>
                </td>
                <td className="border border-black text-center"></td>
                <td className="border border-black text-center">{log.fuel_liters || ''}</td>
                <td className="border border-black text-right px-1">{log.fuel_cost?.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
              </tr>
            ))}
            {emptyRows.map((_, i) => (
              <tr key={`empty-${i}`} className="h-[28px] font-normal">
                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                <td className="border border-black p-0 h-full"><div className="flex divide-x divide-black h-[28px]"><div className="w-1/2"></div><div className="w-1/2"></div></div></td>
                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
              </tr>
            ))}
            
            {/* แถวสรุปผลรวม */}
            <tr className="h-[35px] font-bold text-[11px] align-middle text-black bg-gray-50 print:bg-transparent">
                <td colSpan={3} className="border border-black text-right pr-2">รวม</td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black text-center">
                    {logs.reduce((a, b) => a + (Number(b.fuel_liters) || 0), 0).toFixed(2)}
                </td>
                <td className="border border-black text-right px-1">
                    {logs.reduce((a, b) => a + (Number(b.fuel_cost) || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="border border-black"></td>
                <td className="border border-black text-right px-1"></td>
                <td className="border border-black"></td>
            </tr>
          </tbody>
        </table>

        {/* ส่วนท้ายรายงาน */}
        <div className="mt-2 pl-12 text-[13px] font-normal">
            จึงเรียนเพื่อโปรดทราบ
        </div>

        {/* ลายเซ็นจัดวางกึ่งกลาง */}
        <div className="mt-auto pb-8 flex justify-center items-center w-full font-normal text-[13px]">
          <div className="flex gap-x-32">
            
            {/* ลายเซ็นผู้ขับยานพาหนะ */}
            <div className="flex flex-col items-center w-[280px]">
              <div className="flex w-full items-end">ลงชื่อ <span className="border-b border-dotted border-black flex-grow ml-1 h-5"></span></div>
              <div className="flex w-full items-end my-1">( <span className="border-b border-dotted border-black flex-grow mx-1 h-5 text-center"></span> )</div>
              <div className="flex w-full items-end">ตำแหน่ง <span className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center"></span></div>
              <div className="mt-2 text-center font-bold">ผู้ขับยานพาหนะ</div>
            </div>

            {/* ลายเซ็นผู้ควบคุม */}
            <div className="flex flex-col items-center w-[280px]">
              <div className="flex w-full items-end">ลงชื่อ <span className="border-b border-dotted border-black flex-grow ml-1 h-5"></span></div>
              <div className="flex w-full items-end my-1">( <span className="border-b border-dotted border-black flex-grow mx-1 h-5 text-center"></span> )</div>
              <div className="flex w-full items-end">ตำแหน่ง <span className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center"></span></div>
              <div className="mt-2 text-center font-bold">ผู้ควบคุม</div>
            </div>

          </div>
        </div>

        <div className="absolute bottom-4 left-6 text-[10px] font-normal">ยพ.6-ป.46</div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">กำลังโหลดรายงาน...</div>}>
      <ReportPage />
    </Suspense>
  )
}