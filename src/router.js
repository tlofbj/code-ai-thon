import { createRouter, createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Donate from './pages/Donate.vue'
import Request from './pages/Request.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/donate', component: Donate },
  { path: '/request', component: Request }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
