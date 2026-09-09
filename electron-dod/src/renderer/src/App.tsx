import SettingsPage from './pages/settings/SettingsPage'
import { PetWindowPage } from './pages/pet/PetWindowPage'

function App(): React.JSX.Element {
  const mode = new URLSearchParams(window.location.search).get('mode')

  if (mode === 'pet') {
    return <PetWindowPage />
  }

  return <SettingsPage />
}

export default App
