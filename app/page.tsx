'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth. getUser()
    
    if (!user) {
      // 未登录 → 跳转到登录页
      router.push('/login')
      return
    }

    // 已登录 → 获取用户角色
    const { data: profile } = await supabase
      . from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // 根据角色跳转
    if (profile?. role === 'admin') {
      router.push('/admin')  // 管理员 → 管理员页面
    } else {
      router.push('/member') // 普通用户 → 成员页面
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        {/* 加载动画 */}
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">正在加载... </p>
        <p className="text-gray-400 text-sm mt-2">检查登录状态...</p>
      </div>
    </div>
  )
}