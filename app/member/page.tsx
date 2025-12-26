'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface Document {
  id: string
  title: string
  content: string | null
  created_at: string
  owner_id: string
  file_path: string | null
  file_name: string | null
  file_size:  number | null
  file_type: string | null
  profiles:  { 
    email: string
    full_name: string | null 
  } | null
}

export default function MemberPage() {
  const [user, setUser] = useState<User | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
    await fetchDocuments(user)
  }

  async function fetchDocuments(currentUser: User) {
    setLoading(true)

    try {
      console.log('1. 开始获取权限...')
      
      // 获取我有权限查看的文档ID
      const { data: permissions, error: permError } = await supabase
        .from('document_permissions')
        .select('document_id')
        .eq('user_id', currentUser.id)
        .eq('can_view', true)

      if (permError) {
        console.error('获取权限失败:', permError)
        setLoading(false)
        return
      }

      console.log('2. 权限数据:', permissions)

      if (!permissions || permissions.length === 0) {
        console.log('3. 没有权限')
        setDocuments([])
        setLoading(false)
        return
      }

      // 获取文档详情（使用正确的字段名）
      const documentIds = permissions.map(p => p.document_id)
      console.log('4. 文档IDs:', documentIds)

      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, title, content, created_at, owner_id, file_path, file_name, file_size, file_type')
        .in('id', documentIds)

      if (docsError) {
        console.error('获取文档失败 - 详细错误:', {
          message: docsError. message,
          details: docsError.details,
          hint: docsError.hint,
          code: docsError. code
        })
        setDocuments([])
        setLoading(false)
        return
      }

      console.log('5. 文档数据:', docs)

      // 获取所有文档创建者的信息
      if (docs && docs.length > 0) {
        const ownerIds = [...new Set(docs.map(d => d.owner_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ownerIds)

        console.log('6. 用户资料:', profiles)

        // 合并数据
        const docsWithProfiles = docs.map(doc => ({
          ... doc,
          profiles: profiles?.find(p => p.id === doc.owner_id) || null
        }))

        setDocuments(docsWithProfiles)
        console.log('7. 最终文档:', docsWithProfiles)
      } else {
        setDocuments([])
      }
    } catch (error) {
      console.error('获取文档异常:', error)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function downloadDocument(doc:  Document) {
    // 如果有原始文件，下载原始文件
    if (doc.file_path) {
      setDownloading(doc.id)
      
      try {
        console.log('开始下载文件:', doc.file_path)
        
        const { data, error } = await supabase.storage
          .from('documents')
          .download(doc.file_path)

        if (error) {
          console.error('Storage 下载错误:', error)
          throw error
        }

        console.log('下载成功，文件大小:', data.size)

        // 创建下载链接
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.file_name || doc. title
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        console.log('文件已下载:', doc.file_name)
      } catch (error:  any) {
        console.error('下载失败:', error)
        alert(`下载失败：${error.message || '请联系管理员'}`)
      } finally {
        setDownloading(null)
      }
    } else {
      // 没有原始文件，导出为文本
      const content = `标题: ${doc.title}\n创建时间: ${new Date(doc.created_at).toLocaleString('zh-CN')}\n创建者: ${doc.profiles?.email || '未知'}\n\n内容:\n${doc.content || '无内容'}`
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📂 我的文档</h1>
            <p className="text-gray-600 mt-1">欢迎，{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            退出登录
          </button>
        </div>

        {/* 文档列表 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">可访问的文档</h2>
            <button
              onClick={() => user && fetchDocuments(user)}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              🔄 刷新
            </button>
          </div>

          {loading ? (
            <p className="text-center text-gray-500 py-8">加载中...</p>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">您还没有可访问的文档</p>
              <p className="text-gray-400 text-sm mt-2">
                请联系管理员为您授予文档访问权限
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-6 hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {doc.title}
                      </h3>
                      {doc.content && (
                        <p className="text-gray-600 mb-4">{doc.content}</p>
                      )}
                      
                      {/* 文件信息 */}
                      {doc.file_name ?  (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">📎</span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">
                                {doc.file_name}
                              </p>
                              <div className="flex gap-4 text-sm text-gray-500 mt-1">
                                <span>大小：{formatFileSize(doc.file_size)}</span>
                                {doc.file_type && <span>类型：{doc. file_type}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            ⚠️ 该文档仅有文本内容，无附件文件
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>
                          创建者：{doc.profiles?.email || '未知'}
                        </span>
                        <span>
                          {new Date(doc. created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* 下载按钮 */}
                    <button
                      onClick={() => downloadDocument(doc)}
                      disabled={downloading === doc.id}
                      className={`px-6 py-3 rounded-lg transition flex items-center gap-2 whitespace-nowrap ${
                        doc.file_path
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          :  'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                      title={doc.file_path ?  '下载原始文件' : '导出为文本文件'}
                    >
                      {downloading === doc.id ?  (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>下载中...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>{doc.file_path ? '下载原文件' : '导出文本'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>提示：</strong>您只能查看管理员授予权限的文档。如需访问更多文档，请联系管理员。
          </p>
        </div>
      </div>
    </div>
  )
}