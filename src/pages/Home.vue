<template>
  <div class="home-page">
    <div class="container">
      <div class="home-header">
        <label class="language-label" for="language-select">{{ t.languageLabel }}</label>
        <select id="language-select" v-model="selectedLanguage" class="language-select">
          <option
            v-for="option in languageOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <h1 class="home-title"><span class="home-title-emoji" aria-hidden="true">🌺</span>{{ t.title }}</h1>

      <p v-if="backendWarning" class="fetch-error" role="alert">
        {{ backendWarning }}
      </p>

      <p v-if="fetchError" class="fetch-error" role="alert">
        {{ fetchError }}
        <button type="button" class="retry-inline" @click="fetchData">Retry</button>
      </p>

      <div class="action-buttons">
        <button @click="$router.push('/donate')" class="action-btn donate">
          {{ t.donateButton }}
        </button>
        <button @click="$router.push('/request')" class="action-btn request">
          {{ t.requestButton }}
        </button>
        <button @click="removeMyData" class="action-btn remove-data">
          Remove My Data
        </button>
      </div>

      <div class="lists-grid">
        <div class="list-section">
          <h2>{{ t.onShelf }}</h2>
          <div class="list-container">
            <div v-if="donations.length === 0" class="empty-state">
              {{ t.emptyDonations }}
            </div>
            <ul v-else class="list">
              <li
                v-for="item in donations"
                :key="item.id"
                class="list-item interactive-item request-hover"
                @click="goToRequest(item)"
                @keydown.enter="goToRequest(item)"
                @keydown.space.prevent="goToRequest(item)"
                tabindex="0"
                role="button"
              >
                <div class="item-main">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-qty">{{ t.amountLabel }}: {{ item.amount }}</div>
                </div>
                <div class="item-hover-label">{{ t.requestForThis }}</div>
              </li>
            </ul>
          </div>
        </div>

        <div class="list-section">
          <h2>{{ t.demanded }}</h2>
          <div class="list-container">
            <div v-if="requests.length === 0" class="empty-state">
              {{ t.emptyRequests }}
            </div>
            <ul v-else class="list">
              <li
                v-for="item in requests"
                :key="item.id"
                class="list-item interactive-item donate-hover"
                @click="goToDonate(item)"
                @keydown.enter="goToDonate(item)"
                @keydown.space.prevent="goToDonate(item)"
                tabindex="0"
                role="button"
              >
                <div class="item-main">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-qty">{{ t.amountLabel }}: {{ item.amount }}</div>
                </div>
                <div class="item-hover-label">{{ t.donateThis }}</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiFetch, EXPECTED_API_VERSION } from '../api.js'

export default {
  name: 'Home',
  data() {
    const translations = {
      english: {
        languageLabel: 'Language',
        title: 'DonateMatch',
        donateButton: 'Donate What I Have',
        requestButton: 'Request for What I Need',
        onShelf: 'On the Shelf',
        demanded: 'Demanded',
        emptyDonations: 'No items donated yet',
        emptyRequests: 'No items requested yet',
        amountLabel: 'Amount',
        requestForThis: 'Request for This',
        donateThis: 'Donate This'
      },
      hawaiian: {
        languageLabel: 'ʻŌlelo Hawaiʻi',
        title: 'Kūlike Hāʻawi',
        donateButton: 'Hāʻawi i Kaʻu Mea',
        requestButton: 'Noi i Kaʻu Mea e Pono Ai',
        onShelf: 'Ma ka Papa',
        demanded: 'I Noi ʻia',
        emptyDonations: 'ʻAʻohe mau mea i hāʻawi ʻia',
        emptyRequests: 'ʻAʻohe mau mea i noi ʻia',
        amountLabel: 'Ka Nui',
        requestForThis: 'Noi no Kēia',
        donateThis: 'Hāʻawi i Kēia'
      },
      chinese: {
        languageLabel: '语言',
        title: '捐赠配对',
        donateButton: '捐出我有的东西',
        requestButton: '申请我需要的东西',
        onShelf: '可捐赠清单',
        demanded: '需求清单',
        emptyDonations: '还没有捐赠物品',
        emptyRequests: '还没有需求物品',
        amountLabel: '数量',
        requestForThis: '申请这个',
        donateThis: '捐赠这个'
      },
      japanese: {
        languageLabel: '言語',
        title: '寄付マッチ',
        donateButton: '持っている物を寄付する',
        requestButton: '必要な物をリクエストする',
        onShelf: '寄付可能な品',
        demanded: 'リクエスト中',
        emptyDonations: 'まだ寄付された品はありません',
        emptyRequests: 'まだリクエストされた品はありません',
        amountLabel: '数量',
        requestForThis: 'これをリクエスト',
        donateThis: 'これを寄付'
      },
      korean: {
        languageLabel: '언어',
        title: '기부 매치',
        donateButton: '내가 가진 물품 기부하기',
        requestButton: '필요한 물품 요청하기',
        onShelf: '기부 가능 물품',
        demanded: '요청된 물품',
        emptyDonations: '아직 등록된 기부 물품이 없습니다',
        emptyRequests: '아직 등록된 요청 물품이 없습니다',
        amountLabel: '수량',
        requestForThis: '이 물품 요청',
        donateThis: '이 물품 기부'
      }
    }

    return {
      donations: [],
      requests: [],
      backendWarning: '',
      fetchError: '',
      selectedLanguage: 'english',
      translations
    }
  },
  computed: {
    t() {
      return this.translations[this.selectedLanguage] || this.translations.english
    },
    languageOptions() {
      return [
        { value: 'english', label: 'English' },
        { value: 'hawaiian', label: 'ʻŌlelo Hawaiʻi' },
        { value: 'chinese', label: '中文' },
        { value: 'japanese', label: '日本語' },
        { value: 'korean', label: '한국어' }
      ]
    }
  },
  watch: {
    selectedLanguage() {
      this.applyDocumentTitle()
    }
  },
  mounted() {
    this.applyDocumentTitle()
    this.fetchData()
    this._pollId = setInterval(() => this.fetchData(), 2000)
  },
  beforeUnmount() {
    clearInterval(this._pollId)
  },
  methods: {
    applyDocumentTitle() {
      if (typeof document === 'undefined') return
      document.title = this.t.title
    },
    toQueryValue(value) {
      return String(value ?? '')
    },
    goToRequest(item) {
      this.$router.push({
        path: '/request',
        query: {
          name: this.toQueryValue(item?.name),
          amount: this.toQueryValue(item?.amount)
        }
      })
    },
    goToDonate(item) {
      this.$router.push({
        path: '/donate',
        query: {
          name: this.toQueryValue(item?.name),
          amount: this.toQueryValue(item?.amount)
        }
      })
    },
    async removeMyData() {
      const acknowledged = window.confirm(
        'Are you sure you want to remove your data?\n\n' +
        'Consequences:\n' +
        '- All donation entries linked to your phone number will be permanently deleted.\n' +
        '- Any pending offers connected to those donations may disappear.\n' +
        '- This cannot be undone.'
      )
      if (!acknowledged) return

      const phoneInput = window.prompt(
        'Enter the phone number used for your submissions:'
      )
      if (phoneInput === null) return
      const phone = String(phoneInput).trim()
      if (!phone) {
        alert('Phone number is required.')
        return
      }

      const confirmed = window.confirm(
        `Delete all donation entries for "${phone}"? This action is permanent.`
      )
      if (!confirmed) return

      try {
        const response = await apiFetch('/api/data/remove-donations-by-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          alert(err.error || 'Could not remove data')
          return
        }

        const body = await response.json().catch(() => ({}))
        const deletedCount = Number(body?.deletedCount || 0)
        alert(`Removed ${deletedCount} donation entr${deletedCount === 1 ? 'y' : 'ies'}.`)
        await this.fetchData()
      } catch (error) {
        console.error('Remove data error:', error)
        alert('Could not remove data. Please try again.')
      }
    },
    async fetchData() {
      try {
        const [healthRes, donRes, reqRes] = await Promise.all([
          apiFetch('/api/health'),
          apiFetch('/api/donations'),
          apiFetch('/api/requests')
        ])

        let donations = []
        let requests = []
        let backendWarning = ''

        if (healthRes.ok) {
          const health = await healthRes.json().catch(() => ({}))
          const actualVersion = String(health?.apiVersion || 'missing')
          if (actualVersion !== EXPECTED_API_VERSION) {
            backendWarning =
              `Backend code is out of date (expected ${EXPECTED_API_VERSION}, got ${actualVersion}). ` +
              'Restart `npm run server` so requests and dashboard stay in sync.'
          }
        } else {
          backendWarning =
            `Backend health check failed (${healthRes.status}). ` +
            'Restart `npm run server` to ensure the latest API is running.'
        }

        if (donRes.ok) {
          const raw = await donRes.json()
          donations = Array.isArray(raw) ? raw : []
        }
        if (reqRes.ok) {
          const raw = await reqRes.json()
          requests = Array.isArray(raw) ? raw : []
        }

        this.donations = donations
        this.requests = requests
        this.backendWarning = backendWarning

        if (!donRes.ok || !reqRes.ok) {
          const parts = []
          if (!donRes.ok) parts.push(`donations (${donRes.status})`)
          if (!reqRes.ok) parts.push(`requests (${reqRes.status})`)
          this.fetchError =
            `Could not load submissions (${parts.join(', ')}). ` +
            'Frontend is on 5173 and API is proxied via `/api`; ensure `npm run server` is running.'
          return
        }

        this.fetchError = ''
      } catch (error) {
        console.error('Fetch error:', error)
        this.backendWarning = ''
        this.fetchError =
          'Could not reach `/api` from 5173. Start the backend with `npm run server`.'
      }
    }
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 40px 0;
  background-color: #fdfaf3;
  color: #3f2f22;
}

.home-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.language-label {
  font-size: 14px;
  font-weight: 700;
}

.language-select {
  border: 2px solid #d9c7ad;
  background: #fffdf8;
  color: #3f2f22;
  border-radius: 8px;
  padding: 8px 10px;
}

.home-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 40px;
  text-align: center;
}

.home-title-emoji {
  line-height: 1;
}

.fetch-error {
  padding: 14px 18px;
  margin-bottom: 24px;
  border: 2px solid #b86b3a;
  background: #fdf1dc;
  color: #6d3c1f;
  font-size: 15px;
  line-height: 1.45;
  border-radius: 8px;
}

.retry-inline {
  margin-left: 12px;
  padding: 6px 14px;
  font-size: 14px;
  vertical-align: middle;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 48px;
}

.action-btn {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  font-weight: 700;
  border: 2px solid #d9c7ad;
  color: #3f2f22;
  background: #fbf3e4;
}

.action-btn:hover {
  background: #e8cc9f;
  color: #3f2f22;
  border-color: #b9936c;
}

.action-btn.donate {
  background: linear-gradient(135deg, #c8d8bf 0%, #aec3a2 100%);
  border-color: #8ea885;
  color: #ffffff;
}

.action-btn.request {
  background: linear-gradient(135deg, #e7c8bf 0%, #d9aca0 100%);
  border-color: #bf8c80;
  color: #ffffff;
}

.action-btn.donate:hover {
  background: linear-gradient(135deg, #b8ccb0 0%, #9db892 100%);
  border-color: #7d9774;
  color: #ffffff;
}

.action-btn.request:hover {
  background: linear-gradient(135deg, #ddb8ae 0%, #c99588 100%);
  border-color: #aa7669;
  color: #ffffff;
}

.action-btn.remove-data {
  background: #fffdf8;
  border-color: #d2b08a;
  color: #7a2e2e;
}

.action-btn.remove-data:hover {
  background: #f7ebe3;
  border-color: #b97777;
  color: #5f1f1f;
}

.lists-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 40px;
}

@media (max-width: 768px) {
  .lists-grid {
    grid-template-columns: 1fr;
  }
}

.list-section {
  border: 2px solid #d9c7ad;
  padding: 24px;
  background-color: #fffdf8;
  border-radius: 10px;
}

h2 {
  margin-top: 0;
  color: #5c3d25;
}

.list-container {
  min-height: 200px;
}

.empty-state {
  color: #8d6d52;
  font-style: italic;
  padding: 40px 0;
  text-align: center;
}

.list-item {
  padding: 12px 0;
  border-bottom: 1px solid #d9c5a8;
}

.list-item:last-child {
  border-bottom: none;
}

.interactive-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 12px 10px;
  margin: 0 -10px;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.item-main {
  min-width: 0;
}

.item-hover-label {
  opacity: 0;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.2px;
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

.interactive-item:hover .item-hover-label,
.interactive-item:focus-visible .item-hover-label {
  opacity: 1;
}

.request-hover:hover,
.request-hover:focus-visible {
  background-color: #f2ddc4;
  border-color: #d2a679;
}

.request-hover:hover .item-hover-label,
.request-hover:focus-visible .item-hover-label {
  color: #8a5a2b;
}

.donate-hover:hover,
.donate-hover:focus-visible {
  background-color: #ead4b3;
  border-color: #b9936c;
}

.donate-hover:hover .item-hover-label,
.donate-hover:focus-visible .item-hover-label {
  color: #7a4d29;
}

.item-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.item-qty {
  font-size: 14px;
  color: #8d6d52;
}

@media (max-width: 640px) {
  .home-header {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
