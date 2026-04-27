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

      <div class="items-card request-section">
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
  </div>
</template>

<script>
import LoginModal from '../components/LoginModal.vue'

export default {
  name: 'Request',
  components: {
    LoginModal
  },
  data() {
    return {
      itemName: '',
      itemAmount: '',
      items: [],
      showLoginModal: false
    }
  },
  methods: {
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
    handleSubmit() {
      if (this.items.length === 0) {
        alert('Add at least one item')
        return
      }
      this.showLoginModal = true
    },
    async completeSubmit() {
      try {
        const userId = localStorage.getItem('userId')
        const response = await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, items: this.items })
        })

        if (response.ok) {
          this.$router.push('/')
        }
      } catch (error) {
        console.error('Submit error:', error)
      }
    }
  }
}
</script>

<style scoped>
.request-page {
  min-height: 100vh;
  padding: 40px 0;
  background-color: #0a0a0a;
}

.form-card {
  border: 2px solid #fff;
  padding: 24px;
  background-color: #0a0a0a;
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

.items-card {
  border: 2px solid #fff;
  padding: 24px;
  background-color: #0a0a0a;
  margin-bottom: 32px;
}

h2 {
  margin-top: 0;
}

.empty-state {
  color: #666;
  font-style: italic;
  padding: 40px 0;
  text-align: center;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.remove-btn {
  padding: 6px 12px;
  font-size: 14px;
  background-color: #0a0a0a;
  border: 2px solid #555;
  color: #fff;
}

.remove-btn:hover {
  background-color: #555;
  border-color: #fff;
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
  background-color: #0a0a0a;
  color: #fff;
}
</style>
