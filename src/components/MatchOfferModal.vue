<template>
  <div v-if="isOpen && offer" class="modal-overlay" @click.self="$emit('reject')">
    <div class="modal-content offer-modal">
      <h2>Possible Match Found</h2>
      <p class="offer-lead">
        We found a nearby {{ counterpartLabel }} for <strong>{{ offer.item }}</strong>.
      </p>
      <div class="offer-details">
        <p><strong>Need:</strong> {{ offer.requestedAmount }}</p>
        <p><strong>Available:</strong> {{ offer.offeredAmount }}</p>
        <p><strong>Estimated distance:</strong> {{ formatDistance(offer.distanceKm) }}</p>
        <p v-if="offer.reasoning"><strong>Why this was offered:</strong> {{ offer.reasoning }}</p>
      </div>
      <div class="offer-actions">
        <button type="button" class="primary" @click="$emit('accept')">Accept Offer</button>
        <button type="button" @click="$emit('reject')">Reject</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MatchOfferModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    offer: {
      type: Object,
      default: null
    },
    counterpartLabel: {
      type: String,
      default: 'match'
    }
  },
  methods: {
    formatDistance(distanceKm) {
      const value = Number(distanceKm)
      if (!Number.isFinite(value) || value >= 9999) return 'Unknown'
      return `${value.toFixed(1)} km`
    }
  }
}
</script>

<style scoped>
.offer-modal {
  max-width: 560px;
}

.offer-lead {
  margin-bottom: 16px;
}

.offer-details {
  border: 2px solid #d9c7ad;
  padding: 16px;
  margin-bottom: 20px;
  background: #fff8ec;
}

.offer-details p:last-child {
  margin-bottom: 0;
}

.offer-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.offer-actions button {
  flex: 1 1 180px;
}
</style>
