import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSession } from '../../state/session';
import { useWorkspace } from '../../state/workspace';
import { GoRecord } from '../../lib/types';
import { errorText, money } from '../../lib/format';
import { Screen } from '../../components/Screen';
import { EntryModal } from '../../components/EntryModal';
import { Button, Empty, s } from '../../components/ui';

function GoCard({ record }: { record: GoRecord }) {
  return <View style={s.card}>
    <View style={s.between}><Text style={s.h2}>GO · {record.go_date.slice(0, 10)}</Text><Text style={s.muted}>{record.tons.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ton</Text></View>
    <Text style={s.text}>Price / ton: {money(record.price_per_ton_paise)}</Text>
    <Text style={s.text}>Sales: {money(record.sales_paise)}</Text>
    <Text style={s.text}>Amount received: {money(record.amount_received_paise)}{record.received_date ? ` · ${record.received_date.slice(0, 10)}` : ''}</Text>
    <Text style={s.muted}>Outstanding: {money(record.outstanding_paise)}</Text>
    <Text style={s.muted}>Entered by {record.employee_name}</Text>
  </View>;
}

export default function GoScreen() {
  const { session } = useSession();
  const { gos, refresh } = useWorkspace();
  const [entry, setEntry] = useState(false);
  const [exporting, setExporting] = useState(false);
  const totalSales = gos.reduce((total, row) => total + row.sales_paise, 0);
  const totalReceived = gos.reduce((total, row) => total + row.amount_received_paise, 0);
  const totalOutstanding = gos.reduce((total, row) => total + row.outstanding_paise, 0);

  async function exportExcel() {
    if (!session || exporting) return;
    setExporting(true);
    try {
      const filename = `palm-go-sales-${Date.now()}.xlsx`;
      const file = await File.downloadFileAsync(`${session.api.baseUrl}/reports/go.xlsx`, new File(Paths.cache, filename), {
        headers: { Authorization: `Bearer ${session.api.token}` }, idempotent: true,
      });
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Export GO sales to Excel' });
    } catch (error) { Alert.alert('Could not export GO report', errorText(error)); }
    finally { setExporting(false); }
  }

  return <><Screen title="GO">
    <View style={{ gap: 6 }}><Text style={s.h1}>GO sales</Text><Text style={s.muted}>Track quantity, sales value, receipts and outstanding balances.</Text></View>
    <View style={s.card}><Text style={s.muted}>TOTAL SALES</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[s.h1, { fontSize: 27 }]}>{money(totalSales)}</Text></View>
    <View style={s.wrap}>
      <View style={[s.card, { flexGrow: 1, flexBasis: '45%' }]}><Text style={s.muted}>AMOUNT RECEIVED</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.h2}>{money(totalReceived)}</Text></View>
      <View style={[s.card, { flexGrow: 1, flexBasis: '45%' }]}><Text style={s.muted}>OUTSTANDING</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.h2}>{money(totalOutstanding)}</Text></View>
    </View>
    <Button label="Enter GO" icon="add" onPress={() => setEntry(true)} />
    <Button label={exporting ? 'Preparing Excel…' : 'Download Excel report'} icon="download-outline" secondary disabled={exporting} onPress={() => void exportExcel()} />
    <Text style={[s.h2, { marginTop: 8 }]}>GO records · {gos.length}</Text>
    {gos.length ? gos.map(record => <GoCard key={record.id} record={record} />) : <Empty heading="No GO records yet" detail="Add a GO with the quantity, price per ton and receipt information to see sales totals here." />}
  </Screen>{entry && <EntryModal kind="go" close={() => setEntry(false)} saved={() => { setEntry(false); void refresh(); }} />}</>;
}
