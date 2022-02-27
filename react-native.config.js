/* eslint-disable prettier/prettier */
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.rectanglescanner.RectangleScannerPackage;',
        packageInstance: 'new RectangleScannerPackage()',
      },
    },
  },
  project: {
    ios: {},
    android: {}, // grouped into "project"
  },
  assets: ['./assets/fonts'], // stays the same
},
module.exports={
  dependencies: {
     'react-native-vector-icons': {
        platforms: {
           ios: null,
        },
     },
  },
};

