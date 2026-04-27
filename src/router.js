import { createRouter, createWebHistory } from 'vue-router'
import Login from './pages/Login.vue'
import Home from './pages/Home.vue'
import Donate from './pages/Donate.vue'
import Request from './pages/Request.vue'

const routes = [
  { path: '/login', component: Login },
  { path: '/', component: Home },
  { path: '/donate', component: Donate },
  { path: '/request', component: Request }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('phoneNumber')
  if (to.path !== '/login' && !isLoggedIn) {
    next('/login')
  } else {
    next()
  }
})

export default router
