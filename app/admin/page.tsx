'use client'

import { useState, useEffect } from 'react'
import { supabase, isAdmin } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface StorageFile {
  name: string
  id: string | null
  updated_at: string | null
  created_at: string | null
  last_accessed_at: string | null
  metadata:  {
    eTag: string
    size: number
    mimetype: string
    cacheControl:  string
    lastModified: string
    contentLength: number
    httpStatusCode: number
  }
}

interface Document {
  id: string
  title: string
  content: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  file_type:  string | null
  created_at: string
  owner_id:  string
  profiles?:  {
    email: string
    full_name: string | null
  }
}

interface User {
  id: string
  email: string
  full_name:  string | null
  role: string
  created_at: string
}

interface Permission {
  id: string
  document_id:  string
  user_id: string
  granted_at: string
  documents: {
    title:  string
  } | null
  profiles: {
    email: string
    full_name: string | null
  } | null
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<User[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    console.log('1. 开始检查认证')
    
    const { data: { user } } = await supabase.auth.getUser()
    console.log('2. 当前用户:', user)
    
    if (!user) {
      router.push('/login')
      return
    }

    console.log('3. 检查是否为管理员')
    const admin = await isAdmin()
    console.log('4. 管理员状态:', admin)
    
    if (!admin) {
      router.push('/member')
      return
    }

    setUser(user)
    
    console.log('5. 开始获取数据')
    
    // 逐个执行，便于调试
    await fetchUsers()
    console.log('6. 用户列表获取完成')
    
    await fetchDocuments()
    console.log('7. 文档列表获取完成')
    
    await fetchStorageFiles()
    console.log('8. 文件列表获取完成')
    
    await fetchPermissions()
    console.log('9. 权限列表获取完成')
    
    setLoading(false)
    console.log('10. 加载完成')
  }

  async function fetchUsers() {
    try {
      console.log('→ 开始获取用户列表')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('→ 用户列表错误:', error)
        return
      }
      
      console.log('→ 用户列表成功:', data)
      setUsers(data || [])
    } catch (error: any) {
      console.error('→ 用户列表异常:', error)
    }
  }

  async function fetchDocuments() {
    try {
      console.log('→ 开始获取文档列表')
      
      // 简化查询：不关联 profiles
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('→ 文档列表错误:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
        return
      }
      
      console.log('→ 文档列表成功:', data)
      setDocuments(data || [])
    } catch (error: any) {
      console.error('→ 文档列表异常:', error)
    }
  }

  async function fetchStorageFiles() {
    try {
      console.log('→ 开始获取Storage文件')
      const { data, error } = await supabase.storage
        .from('documents')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (error) {
        console.error('→ Storage文件错误:', error)
        return
      }

      console.log('→ Storage文件成功:', data)
      
      const validFiles = (data || []).filter(file => 
        file.name && !file.name.startsWith('.')
      )
      
      setStorageFiles(validFiles as unknown as StorageFile[])
      
      if (validFiles.length === 0) {
        console.warn('Storage 中没有文件')
      }
    } catch (error: any) {
      console.error('→ Storage文件异常:', error)
    }
  }

  async function fetchPermissions() {
    try {
      console.log('→ 开始获取权限列表')
      
      // 简化查询：不关联其他表
      const { data, error } = await supabase
        .from('document_permissions')
        .select('*')
      
      if (error) {
        console.error('→ 权限列表错误:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
        return
      }
      
      console.log('→ 权限列表成功:', data)
      setPermissions(data || [])
    } catch (error: any) {
      console.error('→ 权限列表异常:', error)
    }
  }

  async function linkFileToDatabase() {
    if (!selectedFile || !newTitle.trim()) {
      alert('请选择文件并输入标题')
      return
    }

    try {
      const file = storageFiles.find(f => f.name === selectedFile)
      if (!file) {
        alert('文件不存在')
        return
      }

      const { error } = await supabase
        .from('documents')
        .insert([
          {
            title: newTitle,
            content: newContent || null,
            file_path: file.name,
            file_name: file.name,
            file_size: file.metadata?.size || null,
            file_type: file.metadata?.mimetype || null,
            owner_id: user.id,
          },
        ])

      if (error) throw error

      setNewTitle('')
      setNewContent('')
      setSelectedFile('')
      fetchDocuments()
      alert('文件已成功关联到数据库！')
    } catch (error: any) {
      console.error('关联文件失败:', error)
      alert('操作失败：' + error.message)
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm('确定要删除这个文档记录吗？（不会删除 Storage 中的实际文件）')) return

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      
      fetchDocuments()
      fetchPermissions()
      alert('删除成功')
    } catch (error: any) {
      console.error('删除文档失败:', error)
      alert('删除失败：' + error.message)
    }
  }

  async function downloadFile(filePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('下载文件失败:', error)
      alert('下载失败：' + error.message)
    }
  }

  async function grantPermission() {
    if (!selectedDoc || !selectedUser) {
      alert('请选择文档和用户')
      return
    }

    try {
      const { error } = await supabase
        .from('document_permissions')
        .insert([
          {
            document_id: selectedDoc,
            user_id: selectedUser,
            can_view: true,
            can_edit: false,
          },
        ])

      if (error) {
        if (error.code === '23505') {
          alert('该用户已有此文档的权限')
        } else {
          throw error
        }
      } else {
        setSelectedDoc('')
        setSelectedUser('')
        fetchPermissions()
        alert('权限授予成功！')
      }
    } catch (error: any) {
      console.error('授予权限失败:', error)
      alert('操作失败：' + error.message)
    }
  }

  async function revokePermission(id: string) {
    if (!confirm('确定要撤销这个权限吗？')) return

    try {
      const { error } = await supabase.from('document_permissions').delete().eq('id', id)
      if (error) throw error
      
      fetchPermissions()
      alert('撤销成功')
    } catch (error: any) {
      console.error('撤销权限失败:', error)
      alert('撤销失败：' + error.message)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">👑 管理员控制台</h1>
            <p className="text-gray-600 mt-1">欢迎，{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            退出登录
          </button>
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">📌 使用说明：</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>先在 Supabase Dashboard → Storage → documents 中上传文件</li>
            <li>点击下方"刷新文件列表"按钮</li>
            <li>在"关联文件"区域选择已上传的文件并输入标题</li>
            <li>在"授予权限"区域给用户分配文档访问权限</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 关联 Storage 文件到数据库 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">🔗 关联 Supabase 文件</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择 Storage 中的文件
              </label>
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择文件 --</option>
                {storageFiles.map((file) => (
                  <option key={file.id || file.name} value={file.name}>
                    {file.name} ({formatFileSize(file.metadata?.size)})
                  </option>
                ))}
              </select>
              {storageFiles.length === 0 && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600 mb-2">
                    ⚠️ 未找到文件，请先在 Supabase Storage 中上传文件
                  </p>
                  <button
                    onClick={fetchStorageFiles}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    🔄 刷新文件列表
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="文档标题（必填）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-2 mb-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <textarea
              placeholder="文档描述（可选）"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 mb-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={linkFileToDatabase}
              disabled={!selectedFile || !newTitle.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              创建文档记录
            </button>
          </div>

          {/* 授予权限 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">🔑 授予文档访问权限</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择文档
              </label>
              <select
                value={selectedDoc}
                onChange={(e) => setSelectedDoc(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择文档 --</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择用户
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择用户 --</option>
                {users.filter(u => u.role !== 'admin').map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} {u.full_name ? `(${u.full_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={grantPermission}
              disabled={!selectedDoc || !selectedUser}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              授予权限
            </button>
          </div>
        </div>

        {/* 所有文档 */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">📚 所有文档记录</h2>
            <button
              onClick={fetchDocuments}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              🔄 刷新
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg mb-2">还没有文档记录</p>
              <p className="text-sm text-gray-400">请先关联 Storage 中的文件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{doc.title}</h3>
                      {doc.content && (
                        <p className="text-gray-600 text-sm mt-1">{doc.content}</p>
                      )}
                      {doc.file_name && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            📎 {doc.file_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        创建者：{doc.profiles?.email || '未知'}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {doc.file_path && (
                        <button
                          onClick={() => downloadFile(
                            doc.file_path as string,
                            doc.file_name || doc.file_path || '文件'
                          )}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition whitespace-nowrap"
                        >
                          下载
                        </button>
                      )}
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200 transition whitespace-nowrap"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 权限列表 */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">🔐 权限管理</h2>
          {permissions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">还没有授予任何权限</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">文档</th>
                    <th className="text-left p-3">用户</th>
                    <th className="text-left p-3">授予时间</th>
                    <th className="text-left p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{perm.documents?.title || '已删除'}</td>
                      <td className="p-3">{perm.profiles?.email || '已删除'}</td>
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(perm.granted_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => revokePermission(perm.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                        >
                          撤销
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 用户列表 */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">👥 所有用户</h2>
          {users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">没有用户</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">邮箱</th>
                    <th className="text-left p-3">姓名</th>
                    <th className="text-left p-3">角色</th>
                    <th className="text-left p-3">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.full_name || '-'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {u.role === 'admin' ? '管理员' : '普通成员'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}