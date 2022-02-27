import {NavigationContainer} from '@react-navigation/native';
import * as React from 'react';
import Thing from './src/Thing';

const App = () => {
  return (
    <NavigationContainer>
      <Thing />
    </NavigationContainer>
  );
};

export default App;
