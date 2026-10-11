/** `/`: the Vazi Wine Cellar shop with the Chiti widget mounted and the demo control panel. */
import { ChitiWidget } from '../components/ChitiWidget'
import { DemoPanel } from '../components/DemoPanel'
import { Storefront } from '../components/Storefront'

export const STORE_TENANT = 'vazi'

export default function StorefrontPage() {
  return (
    <>
      <Storefront />
      <ChitiWidget slug={STORE_TENANT} mode="floating" />
      <DemoPanel slug={STORE_TENANT} />
    </>
  )
}
