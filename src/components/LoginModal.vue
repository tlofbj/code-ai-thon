<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <h2>Verify to Submit</h2>
      <p class="subtitle">Enter your phone and verification code</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            required
          />
        </div>

        <div class="form-group">
          <label for="code">Verification Code</label>
          <input
            id="code"
            v-model="code"
            type="text"
            placeholder="000000"
            required
          />
        </div>

        <button type="submit" class="primary w-full">Verify & Submit</button>
      </form>

      <p class="demo-text">Demo: Any phone and code work</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginModal',
  props: {
    isOpen: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close', 'login'],
  data() {
    return {
      phone: '',
      code: ''
    }
  },
  methods: {
    async handleLogin() {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: this.phone, code: this.code })
        })

        if (response.ok) {
          const data = await response.json()
          localStorage.setItem('phoneNumber', this.phone)
          localStorage.setItem('userId', data.userId)
          this.$emit('login', { phoneNumber: this.phone, userId: data.userId })
          this.phone = ''
          this.code = ''
        }
      } catch (error) {
        console.error('Login error:', error)
      }
    }
  }
}
</script>

<style scoped>
.subtitle {
  font-size: 14px;
  color: #888;
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input {
  width: 100%;
}

.demo-text {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 16px;
}
</style>
