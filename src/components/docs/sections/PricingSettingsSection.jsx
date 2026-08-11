import DocsSection from '../DocsSection.jsx';

export default function PricingSettingsSection() {
  return (
    <DocsSection id="pricing-settings" title="Pricing settings">
      <p>
        Opens from the "Pricing settings" link in the footer of the main
        app. This is where the shop's{' '}
        <strong>condition multiplier table</strong> lives — the percentage
        of a card's Near Mint price that each worse condition is assumed to
        be worth (Near Mint itself is always 100%, not editable).
      </p>
      <p>
        These percentages are what turn an NM reference price into the{' '}
        <strong>Market Value</strong> shown throughout Editing an item and
        the Scanner — see{' '}
        <a href="#glossary">Market Value vs. Our Price</a> for what that
        number actually means. Changing a percentage here changes Market
        Value everywhere it's shown, immediately, for every item — it never
        touches Our Price on any item, since that's always set by hand.
      </p>
    </DocsSection>
  );
}
