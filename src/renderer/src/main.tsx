import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { AppProvider } from './state'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <AppProvider>
    <App />
  </AppProvider>
)
