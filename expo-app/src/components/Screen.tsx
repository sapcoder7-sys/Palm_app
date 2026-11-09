import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkspace } from '../state/workspace';
import { Button, colors, ErrorBox, Icon, Loading, s } from './ui';

export function Screen({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const { loading, error, refresh } = useWorkspace();
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }}><View style={s.row}><Icon name="leaf" /><Text style={[s.h2, { flex: 1 }]}>Palm / {title}</Text></View></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.green} />}>
      {error ? <><ErrorBox message={error} /><Button label="Try again" onPress={() => void refresh()} /></> : loading ? <Loading /> : children}
    </ScrollView>
  </SafeAreaView>;
}
