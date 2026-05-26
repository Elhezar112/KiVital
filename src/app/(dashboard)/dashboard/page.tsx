import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

const STATUS_STYLE = {
  healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',   icon: '⚠️' },
  alert:   { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-100 text-red-700',       icon: '🚨' },
}

export default async function DashboardPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pets = await prisma.pet.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: 'asc' },
    include: {
      healthLogs: {
        orderBy: { date: 'desc' },
        take: 1,
      },
      instantAssessments: {
        orderBy: { logDate: 'desc' },
        take: 1,
      },
    },
  })

  const notLoggedToday = pets.filter(p => {
    const last = p.healthLogs[0]
    if (!last) return true
    return new Date(last.date).getTime() < today.getTime()
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('common.tagline')}</p>
        </div>
        <span className="text-sm text-gray-400">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {pets.length === 0 ? (
        <div className="space-y-4">
          {/* 欢迎引导卡 */}
          <div className="bg-emerald-600 rounded-2xl p-8 text-white">
            <p className="text-2xl font-bold mb-1">欢迎来到 KiVital 🐾</p>
            <p className="text-emerald-100 text-sm mb-6">
              开始追踪你的宠物健康，只需三步
            </p>
            <div className="space-y-3 mb-8">
              {[
                { step: '1', text: '添加你的宠物档案' },
                { step: '2', text: '每天记录饮食、饮水、体重等数据' },
                { step: '3', text: 'AI 自动分析健康状况，生成每周报告' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {s.step}
                  </span>
                  <p className="text-sm text-emerald-50">{s.text}</p>
                </div>
              ))}
            </div>
            <Link
              href="/pets/new"
              className="inline-block bg-white text-emerald-700 font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-emerald-50 transition"
            >
              + 添加第一只宠物
            </Link>
          </div>

          {/* 功能预览 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '🤖', title: 'AI 健康评估', desc: '每次记录后即时分析' },
              { icon: '📊', title: '体重趋势图', desc: '90 天数据可视化' },
              { icon: '📧', title: '每日提醒', desc: '不漏掉任何一次记录' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <p className="text-2xl mb-2">{f.icon}</p>
                <p className="text-xs font-semibold text-gray-700">{f.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 今日未记录提醒 */}
          {notLoggedToday.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <span className="text-lg mt-0.5">🔔</span>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  今日未记录 / Not logged today
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  {notLoggedToday.map(p => p.name).join('、')}
                </p>
              </div>
              <Link
                href={`/log?petId=${notLoggedToday[0].id}`}
                className="ml-auto shrink-0 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition"
              >
                + 记录
              </Link>
            </div>
          )}

          {/* 宠物卡片列表 */}
          <div className="space-y-3">
            {pets.map(pet => {
              const lastLog = pet.healthLogs[0]
              const lastAssessment = pet.instantAssessments[0]
              const status = lastAssessment?.overallStatus as keyof typeof STATUS_STYLE | undefined
              const style = status ? STATUS_STYLE[status] : null

              const daysSinceLog = lastLog
                ? Math.floor((today.getTime() - new Date(lastLog.date).getTime()) / (1000 * 60 * 60 * 24))
                : null

              return (
                <div key={pet.id} className={`rounded-2xl border p-5 space-y-4 ${style ? `${style.bg} ${style.border}` : 'bg-white border-gray-200'}`}>

                  {/* 宠物信息行 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {pet.photoUrl ? (
                        <img src={pet.photoUrl} alt={pet.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="text-3xl">{pet.species === 'CAT' ? '🐱' : '🐶'}</span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{pet.name}</p>
                          {status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style!.badge}`}>
                              {style!.icon} {status === 'healthy' ? '健康' : status === 'warning' ? '注意' : '警告'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {pet.breed ?? (pet.species === 'CAT' ? t('pet.cat') : t('pet.dog'))}
                          {pet.weightKg ? ` · ${pet.weightKg}kg` : ''}
                        </p>
                      </div>
                    </div>

                    {/* 上次记录 */}
                    <div className="text-right">
                      {daysSinceLog === null ? (
                        <p className="text-xs text-gray-400">暂无记录</p>
                      ) : daysSinceLog === 0 ? (
                        <p className="text-xs text-emerald-600 font-medium">✓ 今日已记录</p>
                      ) : (
                        <p className="text-xs text-gray-400">{daysSinceLog}天前记录</p>
                      )}
                    </div>
                  </div>

                  {/* 最近评估摘要 */}
                  {lastAssessment && (
                    <p className="text-xs text-gray-600 bg-white bg-opacity-60 rounded-xl px-3 py-2">
                      {lastAssessment.summary}
                    </p>
                  )}

                  {/* 快捷操作 */}
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      href={`/log?petId=${pet.id}`}
                      className="text-center text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg transition whitespace-nowrap overflow-hidden text-ellipsis px-1"
                    >
                      + {t('nav.logHealth')}
                    </Link>
                    <Link
                      href={`/reports?petId=${pet.id}`}
                      className="text-center text-xs bg-white border border-gray-200 hover:border-emerald-300 text-gray-700 font-medium py-2 rounded-lg transition whitespace-nowrap overflow-hidden text-ellipsis px-1"
                    >
                      ✨ {t('report.weekly')}
                    </Link>
                    <Link
                      href={`/pets/${pet.id}`}
                      className="text-center text-xs border border-gray-200 hover:border-gray-300 text-gray-500 font-medium py-2 rounded-lg transition"
                    >
                      详情 →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 添加宠物 */}
          <Link
            href="/pets/new"
            className="block bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition"
          >
            + {t('pet.addPet')}
          </Link>
        </>
      )}
    </div>
  )
}
