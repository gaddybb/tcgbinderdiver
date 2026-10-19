// The kit gallery (/kit): every component in every state, mirroring board 8 of reference/design.
// A restyle is one look at this page. Screens never add one-off styling; they compose these.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { bannerImageUrl } from '../../core/cards';
import { copy } from '../copy/en';
import { useLayout } from '../layout/useLayout';
import {
  Banner, BinderPicker, Button, CardTable, CardThumb, CardTile, Checkbox, Chip, ColorFilter, Dialog, DialogPanel, EmptyState, GameAnchor, Input,
  ListCard, ListRow, Logo, Menu, MenuList, OddsLabel, PageHeader, ProgressBar, PullVerdict, QuantityBadge, Radio, Rank, Select, SelectHeader, SelectionBar,
  Sheet, SheetPanel, SkeletonRow, StandaloneLink, StatusLabel, StatusPicker, StepIndicator, Stepper, SummaryBar, Switch, TabBar, ToastView,
  TourTip, useToast,
} from '../components';
import type { ColorCategory } from '../components';
import type { CardStatus } from '../../core/status';
import { CARD_STATUSES } from '../../core/status';
import styles from './Kit.module.css';

const k = copy.kit;
const s = k.sample;
const noop = () => {};
const CARD_IMAGE = '/kit-card.svg';

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`kit-${id}`} className={styles.section}>
      <h2 id={`kit-${id}`} className={styles.heading}>{title}</h2>
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.row}>{children}</div>
    </div>
  );
}

function Swatch({ token, name, note }: { token: string; name: string; note?: string }) {
  return (
    <div className={styles.swatch}>
      <span className={styles.chipColor} style={{ background: `var(--color-${token})` }} />
      <span className={styles.swatchName}>{name}</span>
      {note && <span className={styles.swatchNote}>{note}</span>}
    </div>
  );
}

const TILE_EDGES: ColorCategory[] = ['White', 'White', 'Green', 'Green', 'Green'];

export function Kit() {
  const layout = useLayout();
  const toast = useToast();

  const [switchOn, setSwitchOn] = useState(true);
  const [switchOff, setSwitchOff] = useState(false);
  const [chipOn, setChipOn] = useState(true);
  const [chipOff, setChipOff] = useState(false);
  const [colors, setColors] = useState<ColorCategory[]>([]);
  const [stepper, setStepper] = useState(1);
  const [inNext, setInNext] = useState(true);
  const [binder, setBinder] = useState('0');
  const [renameValue, setRenameValue] = useState<string>(s.renameValue);
  const [pickedStatus, setPickedStatus] = useState<CardStatus>('needed');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [found, setFound] = useState([0, 1, 1, 4]);
  const quantities = [1, 1, 4, 4];
  const setFoundAt = (i: number, value: number) => setFound(f => f.map((v, j) => (j === i ? Math.max(0, value) : v)));

  const tileText = [
    { name: s.cardName1, setLabel: s.cardNumber1, price: s.price1, lists: s.lists1 },
    { name: s.cardName2, setLabel: s.cardNumber2, price: s.price2, lists: s.lists2 },
    { name: s.cardName3, setLabel: s.cardNumber3, price: s.price3, lists: s.lists3 },
    { name: s.cardName4, setLabel: s.cardNumber4, price: s.price4, lists: s.lists4 },
  ];

  const menuItems = s.menuItems.map((label, i) => ({ label, onSelect: noop, danger: i === s.menuItems.length - 1 }));
  const hintedItems = menuItems.map((item, i) => ({ ...item, hint: s.menuHints[i] || undefined }));

  return (
    <>
      <header className={styles.head}>
        <h1 className={styles.title}>{k.title}</h1>
        <p className={styles.intro}>{k.intro}</p>
        <div className={styles.meta}>
          <span>{k.layoutNow(layout)}</span>
          <StandaloneLink to="/">{k.backHome}</StandaloneLink>
        </div>
      </header>

      <Section id="colour" title={k.sections.colour} note={k.colourNote}>
        <Group title={k.groups.game}>
          <div className={styles.swatches}>
            <Swatch token="ground" name={k.swatches.ground} note={k.swatches.groundNote} />
            <Swatch token="deep" name={k.swatches.deep} note={k.swatches.deepNote} />
            <Swatch token="floor1" name={k.swatches.floor1} note={k.swatches.floor1Note} />
            <Swatch token="floor2" name={k.swatches.floor2} note={k.swatches.floor2Note} />
            <Swatch token="accent" name={k.swatches.accent} note={k.swatches.accentNote} />
            <Swatch token="tint" name={k.swatches.tint} note={k.swatches.tintNote} />
          </div>
        </Group>
        <Group title={k.groups.fixed}>
          <div className={styles.swatches}>
            <Swatch token="text" name={k.swatches.text} />
            <Swatch token="text-muted" name={k.swatches.muted} />
            <Swatch token="brass" name={k.swatches.brass} note={k.swatches.brassNote} />
            <Swatch token="error" name={k.swatches.error} note={k.swatches.errorNote} />
            <Swatch token="warning" name={k.swatches.warning} note={k.swatches.warningNote} />
          </div>
        </Group>
        <Group title={k.groups.edge}>
          <div className={styles.swatches}>
            <Swatch token="edge-white" name={copy.colors.White.name} />
            <Swatch token="edge-blue" name={copy.colors.Blue.name} />
            <Swatch token="edge-black" name={copy.colors.Black.name} />
            <Swatch token="edge-red" name={copy.colors.Red.name} />
            <Swatch token="edge-green" name={copy.colors.Green.name} />
            <Swatch token="edge-multicolor" name={copy.colors.Multicolor.name} />
            <Swatch token="edge-colorless" name={copy.colors.Colorless.name} />
            <Swatch token="edge-land" name={copy.colors.Land.name} />
          </div>
        </Group>
      </Section>

      <Section id="type" title={k.sections.type} note={k.typeNote}>
        <div className={styles.stack}>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.display}</span><span className={styles.display}>{k.typeSamples.displayText}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.h1}</span><span className={styles.h1}>{k.typeSamples.h1Text}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.h2}</span><span className={styles.h2}>{k.typeSamples.h2Text}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.title}</span><span className={styles.titleSample}>{k.typeSamples.titleText}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.body}</span><span className={styles.body}>{k.typeSamples.bodyText}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.small}</span><span className={styles.small}>{k.typeSamples.smallText}</span></div>
          <div className={styles.typeRow}><span className={styles.typeLabel}>{k.typeSamples.label}</span><span className={styles.label}>{k.typeSamples.labelText}</span></div>
        </div>
      </Section>

      <Section id="buttons" title={k.sections.buttons} note={k.buttonsNote}>
        <Group title={k.groupsHeading.primary}>
          <Button size="lg">{s.primaryBig}</Button>
          <Button>{s.primary}</Button>
        </Group>
        <Group title={k.groupsHeading.secondary}>
          <Button variant="secondary">{s.secondary}</Button>
          <Button variant="text">{s.text}</Button>
        </Group>
        <Group title={k.groupsHeading.danger}>
          <Button variant="danger">{s.danger}</Button>
          <Button disabled>{s.disabled}</Button>
          <Button variant="icon" aria-label={copy.common.previous}>{s.iconPrevious}</Button>
          <Button variant="icon" quiet aria-haspopup="menu" aria-label={s.iconMoreLabel}>{s.iconMore}</Button>
        </Group>
      </Section>

      <Section id="inputs" title={k.sections.inputs}>
        <Group title={k.groupsHeading.textField}>
          <Input label={s.deckName} defaultValue={s.deckNameValue} />
          <Input label={s.search} type="search" placeholder={s.searchPlaceholder} />
        </Group>
        <Group title={k.groupsHeading.selectError}>
          <Select label={s.pullOrder} defaultValue={s.pullOrderOptions[0]}>
            {s.pullOrderOptions.map(o => <option key={o}>{o}</option>)}
          </Select>
          <Input label={s.decklist} multiline rows={2} error={s.decklistError} />
        </Group>
        <Group title={k.groupsHeading.numberStepper}>
          <Input label={s.quantity} type="number" narrow defaultValue={4} />
          <Stepper value={stepper} onChange={setStepper} min={0} max={9} label={s.quantity} />
        </Group>
      </Section>

      <Section id="toggles" title={k.sections.toggles}>
        <Group title={k.groupsHeading.switches}>
          <Switch label={s.inNextDive} checked={switchOn} onChange={setSwitchOn} />
          <Switch label={s.inNextDive} checked={switchOff} onChange={setSwitchOff} />
        </Group>
        <Group title={k.groupsHeading.chips}>
          <Chip pressed={chipOn} onPress={() => setChipOn(v => !v)}>{s.chipOn}</Chip>
          <Chip pressed={chipOff} onPress={() => setChipOff(v => !v)}>{s.chipOff}</Chip>
        </Group>
        <Group title={k.groupsHeading.colourFilter}>
          <ColorFilter selected={colors} onToggle={c => setColors(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))} />
        </Group>
        <Group title={k.groupsHeading.radioCheckbox}>
          <Radio label={s.radio} name="kit-radio" defaultChecked />
          <Checkbox label={s.checkbox} defaultChecked />
        </Group>
      </Section>

      <Section id="labels" title={k.sections.labels}>
        <Group title={k.groupsHeading.status}>
          {CARD_STATUSES.map(status => <StatusLabel key={status} status={status} />)}
        </Group>
        <Group title={k.groupsHeading.verdict}>
          <PullVerdict verdict="worth_a_pull" />
          <PullVerdict verdict="buy_online" />
          <PullVerdict verdict="show_staff" />
        </Group>
        <Group title={k.groupsHeading.odds}>
          <OddsLabel level="best" />
          <OddsLabel level="good" />
          <OddsLabel level="fair" />
          <OddsLabel level="long_shot" />
          <QuantityBadge quantity={4} />
        </Group>
      </Section>

      <Section id="progress" title={k.sections.progress}>
        <Group title={k.groupsHeading.binderProgress}>
          <ProgressBar value={1} max={6} label={copy.progress.binderLabel} caption={copy.progress.bindersFound(1, 6)} />
        </Group>
        <Group title={k.groupsHeading.importSteps}>
          <StepIndicator steps={s.importSteps} current={1} label={s.importStepsLabel} />
        </Group>
      </Section>

      <Section id="tiles" title={k.sections.tiles}>
        <ul className={styles.tiles}>
          {tileText.map((t, i) => (
            <CardTile
              key={t.name}
              {...t}
              imageUrl={CARD_IMAGE}
              edge={TILE_EDGES[i]}
              quantity={quantities[i]}
              found={found[i]}
              onFound={() => setFoundAt(i, found[i] + 1)}
              onUndo={() => setFoundAt(i, found[i] - 1)}
              onOpen={noop}
            />
          ))}
          <CardTile
            name={s.cardName5}
            setLabel={s.cardNumber1}
            price={s.price1}
            lists={s.lists1}
            imageUrl={null}
            edge={TILE_EDGES[4]}
            quantity={1}
            found={0}
            onFound={noop}
            onUndo={noop}
          />
        </ul>
      </Section>

      <Section id="rows" title={k.sections.rows}>
        <Group title={k.groupsHeading.cardRow}>
          <ul className={styles.list}>
            <ListRow lead={<CardThumb edge="White" />} title={s.cardName1} subtitle={`${s.cardSet} · ${s.cardNumber1}`} trailing={s.price1} />
          </ul>
        </Group>
        <Group title={k.groupsHeading.binderRow}>
          <ol className={styles.list}>
            <ListRow lead={<Rank n={1} />} title={s.binderName} subtitle={s.binderSummary} trailing={<PullVerdict verdict="worth_a_pull" />} />
          </ol>
        </Group>
        <Group title={k.groupsHeading.listCard}>
          <ul className={styles.list}>
            <ListCard
              kindLabel={s.listKind}
              title={s.listTitle}
              to="/kit"
              summary={s.listSummary}
              thumbs={['White', 'Green', 'Colorless']}
              bannerSrc={bannerImageUrl('Sol Ring')}
              inNextDive={inNext}
              onInNextDiveChange={setInNext}
              menu={<Menu label={copy.common.moreFor(s.listTitle)} items={menuItems} />}
            />
          </ul>
        </Group>
        <Group title={k.groupsHeading.listCardRename}>
          <ul className={styles.list}>
            <ListCard
              kindLabel={s.listKind}
              title={s.renameValue}
              to="/kit"
              summary={s.listSummary}
              thumbs={[]}
              inNextDive
              onInNextDiveChange={noop}
              menu={<Menu label={copy.common.moreFor(s.renameValue)} items={menuItems} sheetTitle={s.menuSheetTitle} />}
              rename={{ value: renameValue, onChange: setRenameValue, onSave: noop, onCancel: noop }}
            />
          </ul>
        </Group>
        <Group title={k.groupsHeading.summaryBar}>
          <div className={styles.stack}>
            <SummaryBar title={s.summaryTitle} detail={s.summaryDetail} action={<Button>{s.summaryAction}</Button>} />
          </div>
        </Group>
        <Group title={k.groupsHeading.statusPicker}>
          <StatusPicker cardName={s.cardName1} status={pickedStatus} onChange={setPickedStatus} />
        </Group>
        <Group title={k.groupsHeading.cardTable}>
          <div className={styles.stack}>
            <CardTable
              labels={{ table: copy.review.tableLabel(s.listTitle), ...copy.review.columns }}
              rows={[
                { key: 'a', thumb: <CardThumb edge="White" src={CARD_IMAGE} />, name: s.cardName1, quantity: 1, status: <StatusPicker cardName={s.cardName1} status="needed" onChange={noop} />, target: s.cardSet, setLabel: s.cardNumber1, price: s.price1 },
                { key: 'b', thumb: <CardThumb edge="Green" src={CARD_IMAGE} />, name: s.cardName3, quantity: 4, status: <StatusPicker cardName={s.cardName3} status="in_collection" onChange={noop} />, target: s.cardSet, setLabel: s.cardNumber3, price: s.price3 },
              ]}
            />
          </div>
        </Group>
        <Group title={k.groupsHeading.selectionBar}>
          <div className={styles.stack}>
            <SelectionBar
              ariaLabel={copy.bulk.selectedCards(3)}
              label={copy.bulk.selectedCards(3)}
              actions={<><Button variant="secondary">{copy.bulk.setStatus}</Button><Button variant="secondary">{copy.bulk.copyToAnotherList}</Button><Button variant="danger">{copy.bulk.removeFromList}</Button><Button variant="text">{copy.bulk.clearSelection}</Button></>}
            />
            <SelectionBar
              placement="bottom"
              ariaLabel={copy.bulk.selectedShort(3)}
              label={copy.bulk.selectedShort(3)}
              actions={<><Button variant="secondary">{copy.bulk.setStatus}</Button><Button variant="secondary">{copy.bulk.copyToList}</Button><Button variant="danger">{copy.bulk.remove}</Button></>}
            />
          </div>
        </Group>
        <Group title={k.groupsHeading.selectHeader}>
          <div className={styles.stack}>
            <SelectHeader count={3} allSelected={false} onClose={noop} onToggleAll={noop} />
          </div>
        </Group>
        <Group title={k.groupsHeading.selectableRow}>
          <ul className={styles.list}>
            <ListRow
              select={{ checked: true, label: copy.bulk.selectCard(s.cardName1), onChange: noop }}
              lead={<CardThumb edge="White" />}
              title={s.cardName1}
              subtitle={`${s.cardSet} · ${s.cardNumber1}`}
              trailing={<StatusLabel status="needed" />}
            />
            <ListRow
              select={{ checked: false, label: copy.bulk.selectCard(s.cardName2), onChange: noop }}
              lead={<CardThumb edge="White" />}
              title={s.cardName2}
              subtitle={`${s.cardSet} · ${s.cardNumber2}`}
              trailing={<StatusLabel status="needed" />}
            />
          </ul>
        </Group>
        <Group title={k.groupsHeading.setChip}>
          <Chip onRemove={noop} removeLabel={`${copy.common.remove} ${s.setChip}`}>{s.setChip}</Chip>
        </Group>
      </Section>

      <Section id="feedback" title={k.sections.feedback}>
        <Group title={k.groupsHeading.banners}>
          <div className={styles.stack}>
            <Banner tone="info" title={s.bannerInfoTitle}>{s.bannerInfoDetail}</Banner>
            <Banner tone="warning" title={s.bannerWarningTitle}>{s.bannerWarningDetail}</Banner>
            <Banner tone="error" title={s.bannerErrorTitle}>{s.bannerErrorDetail}</Banner>
          </div>
        </Group>
        <Group title={k.groupsHeading.toast}>
          <ToastView message={s.toastMessage} onAction={noop} />
          <Button variant="secondary" onClick={() => toast.show({ message: s.toastMessage, onAction: noop })}>{s.toastLive}</Button>
        </Group>
        <Group title={k.groupsHeading.emptyState}>
          <div className={styles.stack}>
            <EmptyState title={s.emptyTitle} actions={<Button>{s.emptyAction}</Button>}>{s.emptyText}</EmptyState>
          </div>
        </Group>
        <Group title={k.groupsHeading.skeleton}>
          <SkeletonRow label={s.skeletonLabel} />
        </Group>
      </Section>

      <Section id="overlays" title={k.sections.overlays}>
        <Group title={k.groupsHeading.menu}>
          <MenuList label={s.menuLabel} items={menuItems} />
        </Group>
        <Group title={k.groupsHeading.menuSheet}>
          <SheetPanel title={s.menuSheetTitle}>
            <MenuList label={s.menuLabel} items={hintedItems} showHints tabbable />
          </SheetPanel>
        </Group>
        <Group title={k.groupsHeading.sheet}>
          <SheetPanel title={s.sheetTitle}>{s.sheetBody}</SheetPanel>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>{s.sheetOpen}</Button>
        </Group>
        <Group title={k.groupsHeading.dialog}>
          <DialogPanel
            title={s.dialogTitle}
            actions={<><Button variant="secondary">{s.dialogKeep}</Button><Button>{s.dialogEnd}</Button></>}
          >
            {s.dialogBody}
          </DialogPanel>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>{s.dialogOpen}</Button>
        </Group>
        <Group title={k.groupsHeading.tip}>
          <TourTip step={1} total={3} title={s.tipTitle} onSkip={noop} onNext={noop}>{s.tipBody}</TourTip>
        </Group>
      </Section>

      <Section id="navigation" title={k.sections.navigation}>
        <Group title={k.groupsHeading.pageHeader}>
          <div className={styles.stack}>
            <PageHeader level={3} title={s.pageTitle} subtitle={s.pageSubtitle} actions={<Button>{s.pageAction}</Button>} />
          </div>
        </Group>
        <Group title={k.groupsHeading.tabBar}>
          <TabBar
            current="dive"
            items={[
              { id: 'lists', label: copy.tabs.lists, to: '/kit' },
              { id: 'plan', label: copy.tabs.plan, to: '/kit' },
              { id: 'dive', label: copy.tabs.dive, to: '/kit' },
              { id: 'more', label: copy.tabs.more, to: '/kit' },
            ]}
          />
        </Group>
        <Group title={k.groupsHeading.picker}>
          <BinderPicker
            label={s.pickerLabel}
            options={s.pickerOptions.map((label, i) => ({ value: String(i), label }))}
            value={binder}
            onChange={setBinder}
          />
        </Group>
      </Section>

      <Section id="brand" title={k.sections.brand} note={s.logoNote}>
        <Group title={k.groupsHeading.logo}>
          <Logo size="sm" />
          <Logo size="md" />
          <Logo size="lg" />
        </Group>
        <Group title={k.groupsHeading.anchor}>
          <GameAnchor />
        </Group>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={s.sheetTitle}>{s.sheetBody}</Sheet>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={s.dialogTitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{s.dialogKeep}</Button>
            <Button onClick={() => setDialogOpen(false)}>{s.dialogEnd}</Button>
          </>
        }
      >
        {s.dialogBody}
      </Dialog>
    </>
  );
}
