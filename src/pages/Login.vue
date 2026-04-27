<template>
  <div class="login-page">
    <div class="container">
      <div class="login-card">
        <h1>DonateMatch</h1>
        <p class="subtitle">Connect donors and seekers</p>

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

          <button type="submit" class="primary w-full">Verify & Login</button>
        </form>

        <p class="demo-text">Demo: Any phone and code work</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Login',
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
          this.$router.push('/')
        }
      } catch (error) {
        console.error('Login error:', error)
      }
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
}

.login-card {
  border: 2px solid #000;
  padding: 48px;
  background-color: #fff;
  width: 100%;
  max-width: 400px;
}

h1 {
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 24px;
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
  color: #999;
  text-align: center;
  margin-top: 16px;
}
</style>
