import { useEffect, useState } from 'react'
import { getMe } from '../api.js'
import { getStoredUser, getToken, removeStoredUser, removeToken, setStoredUser, setToken } from '../auth.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((res) => {
        setUser(res.data)
        setStoredUser(res.data)
      })
      .catch(() => {
        logout()
      })
      .finally(() => setLoading(false))
  }, [])

  const login = (token, userData) => {
    setToken(token)
    setStoredUser(userData)
    setUser(userData)
  }

  const logout = () => {
    removeToken()
    removeStoredUser()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
