import { useEffect, useState } from 'react'

export function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname || '/')

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (next, { replace = false } = {}) => {
    if (!next) next = '/'
    if (replace) window.history.replaceState({}, '', next)
    else window.history.pushState({}, '', next)
    setPath(window.location.pathname || '/')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return [path, navigate]
}
