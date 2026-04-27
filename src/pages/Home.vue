<template>
  <div class="home-page">
    <div class="container">
      <h1>DonateMatch</h1>

      <div class="action-buttons">
        <button @click="$router.push('/donate')" class="action-btn donate">
          Donate What I Have
        </button>
        <button @click="$router.push('/request')" class="action-btn request">
          Request for What I Need
        </button>
      </div>

      <div class="lists-grid">
        <div class="list-section">
          <h2>On the Shelf</h2>
          <div class="list-container">
            <div v-if="donations.length === 0" class="empty-state">
              No items donated yet
            </div>
            <ul v-else class="list">
              <li v-for="item in donations" :key="item.id" class="list-item">
                <div>
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-qty">Qty: {{ item.quantity }}</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="list-section">
          <h2>Demanded</h2>
          <div class="list-container">
            <div v-if="requests.length === 0" class="empty-state">
              No items requested yet
            </div>
            <ul v-else class="list">
              <li v-for="item in requests" :key="item.id" class="list-item">
                <div>
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-qty">Qty: {{ item.quantity }}</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      donations: [],
      requests: []
    }
  },
  mounted() {
    this.fetchData()
    setInterval(() => this.fetchData(), 2000)
  },
  methods: {
    async fetchData() {
      try {
        const [donRes, reqRes] = await Promise.all([
          fetch('/api/donations'),
          fetch('/api/requests')
        ])

        if (donRes.ok) {
          this.donations = await donRes.json()
        }
        if (reqRes.ok) {
          this.requests = await reqRes.json()
        }
      } catch (error) {
        console.error('Fetch error:', error)
      }
    }
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 40px 0;
  background-color: #0a0a0a;
}

h1 {
  margin-bottom: 40px;
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
  border: 2px solid #fff;
  padding: 24px;
  background-color: #0a0a0a;
}

h2 {
  margin-top: 0;
}

.list-container {
  min-height: 200px;
}

.empty-state {
  color: #666;
  font-style: italic;
  padding: 40px 0;
  text-align: center;
}

.list-item {
  padding: 12px 0;
  border-bottom: 1px solid #333;
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
  color: #888;
}
</style>
