'use client'

import { useEffect, useState } from 'react'

import ChargingHistoryCard from '@/components/ChargingHistoryCard'
import DashboardHeader from '@/components/DashboardHeader'
import DetailPanelCard from '@/components/DetailPanelCard'
import RecommendationsCard from '@/components/RecommendationsCard'
import UserSelectorCard from '@/components/UserSelectorCard'
import UserSummaryCard from '@/components/UserSummaryCard'

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

export default function DashboardPage() {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingUserData, setLoadingUserData] = useState(false)
  const [error, setError] = useState({
    users: null,
    user: null,
    sessions: null,
    recommendations: null,
  })

  useEffect(() => {
    let active = true

    async function loadUsers() {
      setLoadingUsers(true)
      setError((prev) => ({ ...prev, users: null }))

      try {
        const data = await fetchJson('/api/users')
        if (active) setUsers(data)
      } catch {
        if (active) {
          setUsers([])
          setError((prev) => ({ ...prev, users: 'Failed to load users.' }))
        }
      } finally {
        if (active) setLoadingUsers(false)
      }
    }

    loadUsers()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadUserDashboard(userId) {
      setLoadingUserData(true)
      setSelectedUser(null)
      setSessions([])
      setRecommendations([])
      setError((prev) => ({
        ...prev,
        user: null,
        sessions: null,
        recommendations: null,
      }))

      const [userResult, sessionResult, recommendationResult] =
        await Promise.allSettled([
          fetchJson(`/api/users/${userId}`),
          fetchJson(`/api/users/${userId}/sessions`),
          fetchJson(`/api/users/${userId}/recommendations`),
        ])

      if (!active) return

      if (userResult.status === 'fulfilled') {
        setSelectedUser(userResult.value)
      } else {
        setError((prev) => ({ ...prev, user: 'Failed to load user summary.' }))
      }

      if (sessionResult.status === 'fulfilled') {
        setSessions(sessionResult.value)
      } else {
        setError((prev) => ({ ...prev, sessions: 'Failed to load charging history.' }))
      }

      if (recommendationResult.status === 'fulfilled') {
        setRecommendations(recommendationResult.value)
      } else {
        setError((prev) => ({
          ...prev,
          recommendations: 'Failed to load recommendations.',
        }))
      }

      setLoadingUserData(false)
    }

    if (selectedUserId === null) {
      setSelectedUser(null)
      setSessions([])
      setRecommendations([])
      setLoadingUserData(false)
      return () => {
        active = false
      }
    }

    loadUserDashboard(selectedUserId)

    return () => {
      active = false
    }
  }, [selectedUserId])

  function handleSelectUser(userId) {
    setSelectedUserId(userId)
    setSelectedSession(null)
    setSelectedRecommendation(null)
  }

  function handleSelectSession(session) {
    setSelectedSession(session)
    setSelectedRecommendation(null)
  }

  function handleSelectRecommendation(recommendation) {
    setSelectedRecommendation(recommendation)
    setSelectedSession(null)
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <UserSelectorCard
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={handleSelectUser}
        loadingUsers={loadingUsers}
        error={error.users}
      />

      <UserSummaryCard
        selectedUser={selectedUser}
        selectedUserId={selectedUserId}
        loadingUserData={loadingUserData}
        error={error.user}
      />

      <section className="two-column-grid">
        <ChargingHistoryCard
          sessions={sessions}
          selectedUserId={selectedUserId}
          loadingUserData={loadingUserData}
          error={error.sessions}
          selectedSession={selectedSession}
          onSelectSession={handleSelectSession}
        />

        <RecommendationsCard
          recommendations={recommendations}
          selectedUserId={selectedUserId}
          loadingUserData={loadingUserData}
          error={error.recommendations}
          selectedRecommendation={selectedRecommendation}
          onSelectRecommendation={handleSelectRecommendation}
        />
      </section>

      <DetailPanelCard
        selectedSession={selectedSession}
        selectedRecommendation={selectedRecommendation}
      />
    </main>
  )
}
