import { View } from 'react-native'
import { hostScreenStyles as styles } from './host-screen-styles'
import { HostScreenConnectionStatus } from './host-screen-connection-status'
import { HostScreenEmbeddedToolbar } from './host-screen-embedded-toolbar'
import { HostScreenPhoneToolbar } from './host-screen-phone-toolbar'
import type { HostScreenController } from './use-host-screen-controller'

export function HostScreenHeader({ controller }: { controller: HostScreenController }) {
  return (
    <View style={styles.topChrome}>
      <HostScreenConnectionStatus controller={controller} />
      {controller.embedded ? (
        <HostScreenEmbeddedToolbar controller={controller} />
      ) : (
        <HostScreenPhoneToolbar controller={controller} />
      )}
    </View>
  )
}
