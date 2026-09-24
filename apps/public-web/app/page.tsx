import HeroNews from '@/components/home/HeroNews'
import { TournamentWidget, RankingWidget, TrashZone } from '@/components/home/SidebarWidgets'
import NewsFeed from '@/components/home/NewsFeed'
import MaterialsGrid from '@/components/home/MaterialsGrid'

export default function HomePage() {
    return (
        <div className="tw-front">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 34, minWidth: 0 }}>
                <HeroNews />
                <NewsFeed />
                <MaterialsGrid />
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
                <TournamentWidget />
                <RankingWidget />
                <TrashZone />
            </aside>
        </div>
    )
}
