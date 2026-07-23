import { Link } from '@tanstack/react-router'
import { AccountMenu } from '@/components/account-menu'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/" aria-label="QFace 首页">
          <span>QFace</span>
        </Link>

        <nav className="site-nav" aria-label="站点导航">
          <Link to="/experiences">面经</Link>
          <AccountMenu />
        </nav>
      </div>
    </header>
  )
}
