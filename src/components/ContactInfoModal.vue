<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content contact-modal">
      <h2>Offer Accepted</h2>
      <p class="contact-lead">
        Reach out to coordinate pickup.
      </p>
      <div class="contact-details">
        <p><strong>Phone:</strong> {{ phoneDisplay }}</p>
      </div>
      <div class="contact-actions">
        <button type="button" class="primary" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ContactInfoModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    phone: {
      type: String,
      default: ''
    }
  },
  computed: {
    phoneDisplay() {
      const normalized = String(this.phone || '').trim()
      return normalized || 'Not available'
    }
  }
}
</script>

<style scoped>
.contact-modal {
  max-width: 520px;
}

.contact-lead {
  margin-bottom: 16px;
}

.contact-details {
  border: 2px solid #d9c7ad;
  padding: 16px;
  margin-bottom: 20px;
  background: #fff8ec;
}

.contact-details p {
  margin-bottom: 0;
}

.contact-actions {
  display: flex;
}

.contact-actions button {
  flex: 1;
}
</style>
