import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import RNExitApp from 'react-native-exit-app';
import Thing from './src/Thing';
import useAppState from 'react-native-appstate-hook';
import {log, DEBUG, INFO, WARN, ERROR} from './src/config';

const App = () => {
	const {appState} = useAppState({
		onChange: newAppState => {
			log(WARN,`App state changed from ${appState} to ${newAppState}`);
			if (newAppState === 'background') {
				RNExitApp.exitApp();
			}
		},
		onForeground: () => console.warn('App went to Foreground'),
		onBackground: () => console.warn('App went to background. killing it.'),
	});

	return (
		<NavigationContainer>
			<Thing />
		</NavigationContainer>
	);
};

export default App;
