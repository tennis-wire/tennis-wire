import LiveTicker from '@/components/home/LiveTicker'
import HeroNews from '@/components/home/HeroNews'
import { TournamentWidget, RankingWidget } from '@/components/home/SidebarWidgets'
import NewsFeed from '@/components/home/NewsFeed'
import MaterialsGrid from '@/components/home/MaterialsGrid'
import SectionCards from '@/components/home/SectionCards'

export default function HomePage() {
    return (
        <div>
            <LiveTicker />

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 280px',
                    gap: 20,
                    marginBottom: 24,
                }}
            >
                <HeroNews />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <TournamentWidget />
                    <RankingWidget />
                </div>
            </div>

            <NewsFeed />

            <MaterialsGrid />

            <SectionCards />
        </div>
    )
}
