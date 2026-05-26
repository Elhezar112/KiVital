'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Props = {
  petId: string
  photoUrl: string | null
  species: 'CAT' | 'DOG'
}

export default function AvatarUpload({ petId, photoUrl, species }: Props) {
  const [preview, setPreview] = useState<string | null>(photoUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('图片不能超过 5MB')
      return
    }

    setUploading(true)
    setError('')

    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user.id}/${petId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('pet-avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('pet-avatars')
        .getPublicUrl(path)

      const res = await fetch(`/api/pets/${petId}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: publicUrl }),
      })
      if (!res.ok) throw new Error('保存失败')

      setPreview(`${publicUrl}?t=${Date.now()}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传失败，请重试'
      setError(msg)
      setPreview(photoUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 hover:border-emerald-400 transition flex items-center justify-center bg-gray-50"
      >
        {preview ? (
          <>
            <img src={preview} alt="头像" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-xs font-medium">更换</span>
            </div>
          </>
        ) : (
          <div className="text-center pointer-events-none">
            <div className="text-4xl">{species === 'CAT' ? '🐱' : '🐶'}</div>
            <div className="text-xs text-gray-400 mt-0.5">点击上传</div>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-gray-400">点击头像更换图片（最大 5MB）</p>
    </div>
  )
}
