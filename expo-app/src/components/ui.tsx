import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { title } from '../lib/format';

export const colors = { green: '#176B53', ink: '#18382F', muted: '#65776E', background: '#F5F7F3', line: '#DFE7DF', white: '#FFFFFF', amber: '#976418', red: '#AF483F' };
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, color = colors.green, size = 22 }: { name: IconName; color?: string; size?: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}
export function Button({ label, onPress, disabled = false, secondary = false, icon }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: IconName }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.55 }]}>
    {icon && <Icon name={icon} color={secondary ? colors.green : 'white'} size={18} />}
    <Text style={[s.buttonText, secondary && { color: colors.green }]}>{label}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7, marginBottom: 15 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#8B988F" style={s.input} maxLength={200} {...props} /></View>;
}
export function Badge({ status }: { status: string }) {
  const color = ['paid', 'approved', 'active'].includes(status) ? colors.green : status === 'rejected' ? colors.red : colors.amber;
  return <View style={[s.badge, { backgroundColor: `${color}14` }]}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{title(status)}</Text></View>;
}
export function Choices({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <View style={{ gap: 9, marginBottom: 16 }}><Text style={s.label}>{label}</Text><View style={s.wrap}>{options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: option === value }} onPress={() => onChange(option)} style={[s.choice, option === value && s.chosen]}><Text style={{ color: option === value ? colors.green : colors.muted, fontWeight: '600' }}>{title(option)}</Text></Pressable>)}</View></View>;
}
export function Empty({ heading, detail }: { heading: string; detail: string }) {
  return <View style={s.empty}><Icon name="receipt-outline" size={40} /><Text style={s.h2}>{heading}</Text><Text style={[s.muted, { textAlign: 'center' }]}>{detail}</Text></View>;
}
export function ErrorBox({ message }: { message: string }) { return <Text accessibilityRole="alert" style={s.error}>{message}</Text>; }
export function Loading() { return <ActivityIndicator color={colors.green} style={{ padding: 40 }} size="large" />; }
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 36, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  h1: { color: colors.ink, fontSize: 28, fontWeight: '800' }, h2: { color: colors.ink, fontSize: 19, fontWeight: '700' }, text: { color: colors.ink, fontSize: 15 }, muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: colors.white, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.line, gap: 12 },
  button: { backgroundColor: colors.green, borderRadius: 13, paddingHorizontal: 18, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondary: { backgroundColor: '#E6EEE6' }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink }, label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: 'white' }, chosen: { backgroundColor: '#E3EEE5', borderColor: colors.green },
  empty: { alignItems: 'center', padding: 32, gap: 12 }, error: { backgroundColor: '#FBEDE9', color: colors.red, padding: 14, borderRadius: 12, lineHeight: 21 },
});
