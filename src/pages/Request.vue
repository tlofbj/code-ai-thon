<template>
  <div class="request-page">
    <div class="container">
      <h1>Request for What I Need</h1>

      <form @submit.prevent="handleAddItem" class="form-card">
        <div class="form-row">
          <input
            v-model="itemName"
            type="text"
            placeholder="Item name"
            required
          />
          <input
            v-model="itemAmount"
            type="text"
            placeholder="Amount (e.g., 2 kg, 1 box)"
            required
            class="qty-input"
          />
          <button type="submit" class="primary">Add</button>
        </div>
      </form>

      <div class="items-card">
        <h2>Items Requested</h2>
        <div v-if="items.length === 0" class="empty-state">
          No items added yet
        </div>
        <ul v-else class="list">
          <li v-for="(item, index) in items" :key="index" class="list-item">
            <div>
              <div class="item-name">{{ item.name }}</div>
              <div class="item-qty">Amount: {{ item.amount }}</div>
            </div>
            <button @click="removeItem(index)" class="remove-btn">Remove</button>
          </li>
        </ul>
      </div>

      <div class="action-buttons">
        <button @click="handleSubmit" :disabled="items.length === 0" class="request">Submit Request</button>
        <button @click="$router.push('/')">Cancel</button>
      </div>
    </div>

    <LoginModal :isOpen="showLoginModal" @login="completeSubmit" @close="showLoginModal = false" />
    <MatchOfferModal
      :isOpen="showOfferModal"
      :offer="matchOffer"
      counterpartLabel="donation"
      @accept="respondToOffer('accept')"
      @reject="respondToOffer('reject')"
    />
    <ContactInfoModal
      :isOpen="showContactModal"
      :phone="matchPhone"
      @close="finishAndReturnHome"
    />
  </div>
</template>

<script>
import { apiFetch } from '../api.js'
import LoginModal from '../components/LoginModal.vue'
import MatchOfferModal from '../components/MatchOfferModal.vue'
import ContactInfoModal from '../components/ContactInfoModal.vue'

export default {
  name: 'Request',
  components: {
    LoginModal,
    MatchOfferModal,
    ContactInfoModal
  },
  data() {
    return {
      itemName: '',
      itemAmount: '',
      items: [],
      location: '',
      isLocating: false,
      showLoginModal: false,
      showOfferModal: false,
      matchOffer: null,
      showContactModal: false,
      matchPhone: '',
      submittingUserId: null
    }
  },
  mounted() {
    this.prefillFromQuery()
  },
  methods: {
    askForDataUseConsent() {
      const message =
        'Before submitting:\n' +
        '- Location is used to estimate distance and find nearby matches.\n' +
        '- Phone number is used to identify your account and share contact info after a match is accepted.\n\n' +
        'Do you agree to continue?'
      const agreed = window.confirm(message)
      if (agreed) return true

      const leavePage = window.confirm(
        'If you do not agree, your submission cannot continue. Leave this page now?'
      )
      if (leavePage) this.$router.push('/')
      return false
    },
    prefillFromQuery() {
      const name = String(this.$route.query.name || '').trim()
      const amount = String(this.$route.query.amount || '').trim()
      if (!name && !amount) return

      this.itemName = name
      this.itemAmount = amount
    },
    handleAddItem() {
      if (this.itemName.trim() && this.itemAmount.trim()) {
        this.items.push({
          name: this.itemName,
          amount: this.itemAmount
        })
        this.itemName = ''
        this.itemAmount = ''
      }
    },
    removeItem(index) {
      this.items.splice(index, 1)
    },
    async handleSubmit() {
      if (this.items.length === 0) {
        alert('Add at least one item')
        return
      }
      const hasConsent = this.askForDataUseConsent()
      if (!hasConsent) return
      if (!this.location.trim()) {
        const detected = await this.requestCurrentLocation()
        if (!detected) {
          alert('We could not detect your location. Please allow location access and try again.')
          return
        }
      }
      this.showLoginModal = true
    },
    requestCurrentLocation() {
      if (this.location.trim()) return Promise.resolve(true)
      if (this.isLocating) {
        return new Promise((resolve) => {
          const waitForDetection = () => {
            if (!this.isLocating) {
              resolve(Boolean(this.location.trim()))
              return
            }
            setTimeout(waitForDetection, 150)
          }
          waitForDetection()
        })
      }
      if (!navigator?.geolocation) {
        return Promise.resolve(false)
      }

      this.isLocating = true
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = Number(position?.coords?.latitude)
            const lng = Number(position?.coords?.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              this.isLocating = false
              resolve(false)
              return
            }
            this.location = `${lat.toFixed(6)},${lng.toFixed(6)}`
            this.isLocating = false
            resolve(true)
          },
          () => {
            this.isLocating = false
            resolve(false)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        )
      })
    },
    async completeSubmit(payload) {
      this.showLoginModal = false
      try {
        const userId =
          payload?.userId ?? Number(localStorage.getItem('userId'))
        this.submittingUserId = userId
        const response = await apiFetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, items: this.items, location: this.location })
        })

        if (response.ok) {
          const body = await response.json().catch(() => ({}))
          if (body?.offer) {
            this.matchOffer = body.offer
            this.showOfferModal = true
            return
          }
          this.finishAndReturnHome()
          return
        }
        const err = await response.json().catch(() => ({}))
        alert(err.error || 'Could not submit request')
      } catch (error) {
        console.error('Submit error:', error)
        alert('Could not submit request. Try again.')
      }
    },
    async respondToOffer(decision) {
      const userId = this.submittingUserId ?? Number(localStorage.getItem('userId'))
      const offerId = this.matchOffer?.id

      if (!offerId) {
        this.finishAndReturnHome()
        return
      }

      try {
        const response = await apiFetch(`/api/offers/${offerId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, decision })
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          alert(err.error || 'Could not record offer response')
          return
        }

        const body = await response.json().catch(() => ({}))
        if (decision === 'accept') {
          this.matchPhone = String(body?.donorPhone || '').trim()
          this.showOfferModal = false
          this.matchOffer = null
          this.showContactModal = true
          return
        }

        const nextOffer = body?.nextOffer || null
        if (nextOffer) {
          this.matchOffer = nextOffer
          this.showOfferModal = true
          return
        }
      } catch (error) {
        console.error('Offer response error:', error)
      }
      this.finishAndReturnHome()
    },
    finishAndReturnHome() {
      this.showOfferModal = false
      this.showContactModal = false
      this.matchOffer = null
      this.matchPhone = ''
      this.items = []
      this.location = ''
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.request-page {
  min-height: 100vh;
  padding: 40px 0;
  background-color: #fdfaf3;
}

.form-card {
  border: 2px solid #d9c7ad;
  padding: 24px;
  background-color: #fffdf8;
  margin-bottom: 32px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row input {
  flex: 1;
}

.qty-input {
  flex: 0 0 100px;
}

.form-row button {
  flex: 0 0 120px;
}

.form-row .primary {
  background: linear-gradient(135deg, #c8d8bf 0%, #aec3a2 100%);
  border-color: #8ea885;
  color: #ffffff;
}

.form-row .primary:hover {
  background: linear-gradient(135deg, #b8ccb0 0%, #9db892 100%);
  border-color: #7d9774;
  color: #ffffff;
}

.items-card {
  border: 2px solid #d9c7ad;
  padding: 24px;
  background-color: #fffdf8;
  margin-bottom: 32px;
}

h2 {
  margin-top: 0;
}

.empty-state {
  color: #8d6d52;
  font-style: italic;
  padding: 40px 0;
  text-align: center;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e4d4bc;
}

.list-item:last-child {
  border-bottom: none;
}

.item-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.item-qty {
  font-size: 14px;
  color: #8d6d52;
}

.remove-btn {
  padding: 6px 12px;
  font-size: 14px;
  background-color: #fffdf8;
  border: 2px solid #d9c7ad;
  color: #3f2f22;
}

.remove-btn:hover {
  background-color: #f6ecdc;
  border-color: #cdb48f;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-direction: column;
}

.action-buttons button {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}

.action-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-buttons button:disabled:hover {
  background-color: #fffdf8;
  color: #3f2f22;
}
</style>
