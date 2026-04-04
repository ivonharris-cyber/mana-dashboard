import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api } from '../lib/api'

interface User {
  id: number
  username: string
  name: string
  role: string
}

interface AuthContextType {
  token: string | null
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function getStoredAuth(): { token: string | null; user: User | null } {
  const token = localStorage.getItem('mana_token')
  const userStr = localStorage.getItem('mana_user')
  let user: User | null = null
  if (userStr) {
    try {
      user = JSON.parse(userStr)
    } catch {
      user = null
    }
  }
  return { token, user }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = getStoredAuth()
  const [token, setToken] = useState<string | null>(stored.token)
  const [user, setUser] = useState<User | null>(stored.user)

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post('/auth/login', { username, password })
    localStorage.setItem('mana_token', data.token)
    localStorage.setItem('mana_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('mana_token')
    localStorage.removeItem('mana_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
