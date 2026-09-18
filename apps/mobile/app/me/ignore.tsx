import { ScrollView } from 'react-native'

import { Screen, Text } from '../../components/ui'
import IgnoreList from '../../components/discussion/IgnoreList'
import { strings } from '../../components/discussion/strings'

export default function IgnoreListScreen() {
    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text variant="caption" style={{ marginBottom: 16 }}>
                    {strings.ignoreListAbout}
                </Text>
                <IgnoreList />
            </ScrollView>
        </Screen>
    )
}
