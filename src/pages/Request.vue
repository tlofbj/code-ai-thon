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
            v-model.number="itemQty"
            type="number"
            placeholder="Qty"
            min="1"
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
              <div class="item-qty">Qty: {{ item.quantity }}</div>
            </div>
            <button @click="removeItem(index)" class="remove-btn">Remove</button>
          </li>
        </ul>
      </div>

      <div class="action-buttons">
        <button @click="handleSubmit" class="primary">Submit Request</button>
        <button @click="$router.push('/')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Request',
  data() {
    return {
      itemName: '',
      itemQty: 1,
      items: []
    }
  },
  methods: {
    handleAddItem() {
      if (this.itemName.trim()) {
        this.items.push({
          name: this.itemName,
          quantity: this.itemQty
        })
        this.itemName = ''
        this.itemQty = 1
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
  background-color: #fafafa;
}

.form-card {
  border: 2px solid #000;
  padding: 24px;
  background-color: #fff;
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
  border: 2px solid #000;
  padding: 24px;
  background-color: #fff;
  margin-bottom: 32px;
}

h2 {
  margin-top: 0;
}

.empty-state {
  color: #999;
  font-style: italic;
  padding: 40px 0;
  text-align: center;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
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
  color: #666;
}

.remove-btn {
  padding: 6px 12px;
  font-size: 14px;
  background-color: #fff;
  border: 2px solid #e0e0e0;
  color: #000;
}

.remove-btn:hover {
  background-color: #f5f5f5;
  border-color: #000;
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
</style>
