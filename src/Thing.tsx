/* eslint-disable react-native/no-inline-styles */
// import 'react-native-gesture-handler';
import PropTypes from 'prop-types';
import React, {PureComponent, RefObject} from 'react';
// import Image from 'react-native-scalable-image';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
// import Scanner, {
//   DetectedRectangle,
//   Filters,
//   RectangleOverlay,
// } from 'react-native-rectangle-scanner';
import ScannerFilters from './Filters';
import {LogBox} from 'react-native'; // Ignore specific Warnings: LogBox.ignoreLogs(['Warning: ...']); // Ignore log notification by message    -OR-    Ignore all log notifications: LogBox.ignoreAllLogs();
// import Orientation from 'react-native-orientation-locker';
import Styles from './Styles';
// import Invoices, {Invoice} from './Invoices';
import {log} from './config';

LogBox.ignoreAllLogs(); // Ignore all log notifications

interface IProps {
  scannerIsOn: false;
  onFilterIdChange: null;
  onPictureTaken: false;
  onLayout: false;
  onPictureProcessed: false;
  onAcceptImage: () => {};
  onRejectImage: false;
  registerInvoicesTimerMinMs: number;
  registerInvoicesTimerMultiplier: number;
  registerInvoicesTimerMaxMs: number;
}

interface IState {
  flashEnabled: boolean;
  showScannerView: boolean;
  didLoadInitialLayout: boolean;
  filterId: number;
  // detectedRectangle?: DetectedRectangle;
  isMultiTasking: boolean;
  isLoadingScanner: boolean;
  isProcessingImage: boolean;
  takingPicture: boolean;
  overlayFlashOpacity: Animated.Value;
  isDisplayDocumentMode: boolean;
  imageCachePath: string;
  device: {
    initialized: boolean;
    hasCamera: boolean;
    permissionToUseCamera: boolean;
    flashIsAvailable: boolean;
    previewHeightPercent: number;
    previewWidthPercent: number;
  };
}

const styles = Styles.scannerStyles;

export default class InvoiceScanner extends PureComponent<IProps, IState> {
  static propTypes = {
    cameraIsOn: PropTypes.bool,
    initialFilterId: PropTypes.number,
    onLayout: PropTypes.func,
    onCancel: PropTypes.func,
    onRejectImage: PropTypes.func,
    onAcceptImage: PropTypes.func,
    onPictureTaken: PropTypes.func,
    onPictureProcessed: PropTypes.func,
    onFilterIdChange: PropTypes.func,
  };
  static defaultProps = {
    cameraIsOn: undefined,
    // initialFilterId: Filters.PLATFORM_DEFAULT_FILTER_ID,
    onLayout: () => {},
    onCancel: () => {},
    onRejectImage: () => {},
    onAcceptImage: () => {},
    onPictureTaken: () => {},
    onPictureProcessed: () => {},
    onFilterIdChange: () => {},
    registerInvoicesTimerMinMs: 10 /* Seconds */ * 1000,
    registerInvoicesTimerMultiplier: 1,
    registerInvoicesTimerMaxMs: 60 /* Minutes */ * 10000,
  };
  camera: RefObject<any>;
  imageProcessorTimeout = setTimeout(() => {
    if (this.state.takingPicture) {
      this.setState({takingPicture: false});
    }
  }, 100);

  registerInvoicesTimeout: any;

  constructor(props: any) {
    super(props);
    log.debug(`InvoiceScanner: constructor(${props})`);
    this.state = {
      flashEnabled: false,
      showScannerView: false,
      didLoadInitialLayout: false,


      // filterId: props.initialFilterId || Filters.PLATFORM_DEFAULT_FILTER_ID,
      filterId: 0,

      isMultiTasking: false,
      isLoadingScanner: true,
      isProcessingImage: false,
      takingPicture: false,
      overlayFlashOpacity: new Animated.Value(0),
      isDisplayDocumentMode: false,
      imageCachePath: '',
      device: {
        initialized: false,
        hasCamera: false,
        permissionToUseCamera: false,
        flashIsAvailable: false,
        previewHeightPercent: 1,
        previewWidthPercent: 1,
      },
    };

    this.camera = React.createRef();
    LogBox.ignoreAllLogs();
  }
  async registerInvoicesTimer(interval: number) {
    if (interval < this.props.registerInvoicesTimerMinMs) {
      interval = this.props.registerInvoicesTimerMinMs;
    }
    if (interval > this.props.registerInvoicesTimerMaxMs) {
      interval = this.props.registerInvoicesTimerMaxMs;
    }
    log.info('awaiting Invoices.registerInvoices');
    // const remainingInvoiceCount = await Invoices.registerInvoices();
    // log.info(`remainingInvoiceCount ${remainingInvoiceCount}`);
    // remainingInvoiceCount
    //   ? (interval *= this.props.registerInvoicesTimerMultiplier)
    //   : (interval = this.props.registerInvoicesTimerMinMs);
    this.registerInvoicesTimeout = setTimeout(() => {
      log.info(`registerInvoicesTimeout interval: ${interval} `);
      this.registerInvoicesTimer(interval);
    }, interval);
  }
  componentDidMount() {
    log.info('InvoiceScanner: componentDidMount'); // reh debug
    // Invoices.clearAllInvoicesOnDevice(); // reh debug
    // Orientation.lockToPortrait();
    if (this.state.didLoadInitialLayout && !this.state.isMultiTasking) {
      this.turnOnScanner();
    }
    this.registerInvoicesTimer(this.props.registerInvoicesTimerMinMs);
  }
  componentDidUpdate() {
    log.debug('InvoiceScanner: componentDidUpdate()');
    if (this.state.didLoadInitialLayout) {
      if (this.state.isMultiTasking) {
        return this.turnOffScanner(true);
      }
      if (this.state.device.initialized) {
        if (!this.state.device.hasCamera) {
          return this.turnOffScanner();
        }
        if (!this.state.device.permissionToUseCamera) {
          return this.turnOffScanner();
        }
      }
      if (this.props.scannerIsOn && !this.state.showScannerView) {
        return this.turnOnScanner();
      }
      if (this.props.scannerIsOn === false && this.state.showScannerView) {
        return this.turnOffScanner(true);
      }
      if (this.props.scannerIsOn === undefined) {
        return this.turnOnScanner();
      }
    }
    return null;
  }
  componentWillUnmount() {
    log.debug('InvoiceScanner: componentWillUnmount()');
    clearTimeout(this.imageProcessorTimeout);
    clearTimeout(this.registerInvoicesTimeout);
  }
  // Called after the device gets setup. This lets you know some platform specifics
  // like if the device has a camera or flash, or even if you have permission to use the
  // camera. It also includes the aspect ratio correction of the preview
  onDeviceSetup = (deviceDetails: any) => {
    log.debug(`InvoiceScanner: onDeviceSetup(${deviceDetails})`);
    const {
      hasCamera,
      permissionToUseCamera,
      flashIsAvailable,
      previewHeightPercent,
      previewWidthPercent,
    } = deviceDetails;
    this.setState({
      isLoadingScanner: false,
      device: {
        initialized: true,
        hasCamera,
        permissionToUseCamera,
        flashIsAvailable,
        previewHeightPercent: previewHeightPercent || 1,
        previewWidthPercent: previewWidthPercent || 1,
      },
    });
  };
  onFilterIdChange = (id: any) => {
    log.debug(`InvoiceScanner: onFilterIdChange(${id})`);
    this.setState({filterId: id});
  };
  // Why the camera is disabled.
  getCameraDisabledMessage() {
    log.debug('InvoiceScanner: getCameraDisabledMessage()');
    if (this.state.isMultiTasking) {
      return 'Camera is not allowed in multi tasking mode.';
    }
    const {device} = this.state;
    if (device.initialized) {
      if (!device.hasCamera) {
        return 'Could not find a camera on the device.';
      }
      if (!device.permissionToUseCamera) {
        return 'Permission to use camera has not been granted.';
      }
    }
    return 'Failed to set up the camera.';
  }
  // On some android devices, the aspect ratio of the preview is different than
  // the screen size. This leads to distorted camera previews. This allows for correcting that.
  getPreviewSize() {
    log.debug('InvoiceScanner: getPreviewSize()');
    const dimensions = Dimensions.get('window');
    // We use set margin amounts because for some reasons the percentage values don't align the camera preview in the center correctly.
    const heightMargin =
      ((1 - this.state.device.previewHeightPercent) * dimensions.height) / 2;
    const widthMargin =
      ((1 - this.state.device.previewWidthPercent) * dimensions.width) / 2;
    if (dimensions.height > dimensions.width) {
      // Portrait
      return {
        height: this.state.device.previewHeightPercent,
        width: this.state.device.previewWidthPercent,
        marginTop: heightMargin,
        marginLeft: widthMargin,
      };
    }

    // Landscape
    return {
      width: this.state.device.previewHeightPercent,
      height: this.state.device.previewWidthPercent,
      marginTop: widthMargin,
      marginLeft: heightMargin,
    };
  }
  // Capture the current frame/rectangle. Triggers the flash animation and shows a
  // loading/processing state. Will not take another picture if already taking a picture.
  capturePicture = () => {
    log.info('InvoiceScanner: capturePicture()');
    if (this.state.takingPicture || this.state.isProcessingImage) {
      return;
    }
    this.setState({takingPicture: true, isProcessingImage: true});
    if (this.camera && this.camera.current) {
      this.camera.current.capture();
    }
    this.triggerSnapAnimation();

    // If capture failed, allow for additional captures
    this.imageProcessorTimeout = setTimeout(() => {
      if (this.state.takingPicture) {
        this.setState({takingPicture: false});
      }
    }, 100);
  };
  // The picture was captured but still needs to be processed.
  onPictureTaken = (event: any) => {
    log.info(`InvoiceScanner: onPictureTaken(${JSON.stringify(event)})`);
    this.setState({takingPicture: false});
  };
  // The picture was taken and cached. You can now go on to using it.
  onPictureProcessed = (event: any) => {
    log.info(`InvoiceScanner: onPictureProcessed(${JSON.stringify(event)}`);
    this.setState({
      takingPicture: false,
      isProcessingImage: false,
      showScannerView: this.props.scannerIsOn || false,
    });
    const quotedString = JSON.stringify(event.croppedImage);
    const unquotedString = quotedString.replace(/"/g, '');
    const imageCachePath = unquotedString;
    this.setState({
      imageCachePath: imageCachePath,
      isDisplayDocumentMode: true,
    });
  };
  // async createInvoice(imageCachePath: string): Promise<Invoice> {
  //   log.info(`InvoiceScanner  createInvoice(${imageCachePath})`);
  //   var invoice: any;
  //   try {
  //     invoice = await Invoices.createInvoiceFromImage(imageCachePath);
  //   } catch (err) {
  //     log.error(`Invoices.createInvoiceFromImage: ${err}`);
  //   }
  //   if (invoice) {
  //     this.registerInvoicesTimer(this.props.registerInvoicesTimerMinMs);
  //   }
  //   return invoice;
  // }
  triggerSnapAnimation() {
    log.debug('InvoiceScanner: triggerSnapAnimation()');
    // Flashes the screen on capture
    Animated.sequence([
      Animated.timing(this.state.overlayFlashOpacity, {
        toValue: 0.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(this.state.overlayFlashOpacity, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(this.state.overlayFlashOpacity, {
        toValue: 0.6,
        delay: 100,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(this.state.overlayFlashOpacity, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }
  // Hides the camera view. If the camera view was shown and onDeviceSetup was called,
  // but no camera was found, it will not uninitialize the camera state.
  turnOffScanner(shouldUninitializeScanner = false) {
    log.debug(`InvoiceScanner: turnOffScanner(${shouldUninitializeScanner})`);
    //reh--this was already cmt
    // if (shouldUninitializeCamera && this.state.device.initialized) {
    //   this.setState(({ device }) => ({
    //     showScannerView: false,
    //     device: { ...device, initialized: false },
    //   }));
    // } else if (this.state.showScannerView) {
    //   this.setState({ showScannerView: false });
    // }
  }

  // Will show the camera view which will setup the camera and start it.
  // Expect the onDeviceSetup callback to be called
  turnOnScanner() {
    log.debug('InvoiceScanner: turnOnScanner()');
    if (!this.state.showScannerView) {
      this.setState({
        showScannerView: true,
        isLoadingScanner: true,
      });
    }
  }
  // Renders the flashlight button. Only shown if the device has a flashlight.
  renderFlashControl() {
    log.debug('InvoiceScanner: renderFlashControl()');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {flashEnabled, device} = this.state;
    // reh -- already: simulators not show flashIsAvailable on deviceInfo
    // if (!device.flashIsAvailable) return null;
    return (
      <TouchableOpacity
        style={[
          styles.flashControl,
          {backgroundColor: flashEnabled ? '#FFFFFF80' : '#00000080'},
        ]}
        activeOpacity={0.8}
        onPress={() => this.setState({flashEnabled: !flashEnabled})}>
        <Icon
          name="ios-flashlight"
          style={[
            styles.buttonIcon,
            {fontSize: 28, color: flashEnabled ? '#333' : '#FFF'},
          ]}
        />
      </TouchableOpacity>
    );
  }
  // Renders the scanner controls. This will show controls on the side for large tablet screens
  // or on the bottom for phones. (For small tablets it will adjust the view a little bit).
  renderScannerControls() {
    log.debug('InvoiceScanner: renderScannerControls()');
    const dimensions = Dimensions.get('window');
    const aspectRatio = dimensions.height / dimensions.width;
    const isPhone = aspectRatio > 1.6;
    const cameraIsDisabled =
      this.state.takingPicture || this.state.isProcessingImage;
    const disabledStyle = {opacity: cameraIsDisabled ? 0.8 : 1};

    if (!isPhone) {
      // a tablet

      if (dimensions.height < 500) {
        return (
          <View style={styles.buttonContainer}>
            <View style={[styles.cameraOutline, disabledStyle]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cameraButton}
                onPress={this.capturePicture}
              />
            </View>
            {this.renderFlashControl()}
            <View
              style={[
                styles.buttonBottomContainer,
                {
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  marginBottom: 28,
                },
              ]}>
              <ScannerFilters
                filterId={this.state.filterId}
                onFilterIdChange={this.onFilterIdChange}
              />
            </View>
          </View>
        );
      } else {
        return (
          <View style={styles.buttonBottomContainer}>
            {this.renderFlashControl()}
            <View style={[styles.cameraOutline, disabledStyle]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cameraButton}
                onPress={this.capturePicture}
              />
            </View>
            <View
              style={[
                styles.buttonActionGroup,
                {justifyContent: 'flex-end', marginBottom: 20},
              ]}>
              <ScannerFilters
                filterId={this.state.filterId}
                onFilterIdChange={this.onFilterIdChange}
              />
            </View>
          </View>
        );
      }
    } else {
      // a phone
      return (
        <>
          <View style={styles.buttonBottomContainer}>
            {this.renderFlashControl()}
            <View style={[styles.cameraOutline, disabledStyle]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cameraButton}
                onPress={this.capturePicture}
              />
            </View>
            <ScannerFilters
              filterId={this.state.filterId}
              onFilterIdChange={this.onFilterIdChange}
            />
          </View>
        </>
      );
    }
  }
  // Renders the camera controls or a loading/processing state
  renderScannerOverlay() {
    log.debug('InvoiceScanner: renderScannerOverlay()');
    let loadingState = null;
    if (this.state.isLoadingScanner) {
      loadingState = (
        <View style={styles.overlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="white" />
            <Text style={styles.loadingCameraMessage}>Loading Camera</Text>
          </View>
        </View>
      );
    } else if (this.state.isProcessingImage) {
      loadingState = (
        <View style={styles.overlay}>
          <View style={styles.loadingContainer}>
            <View style={styles.processingContainer}>
              <ActivityIndicator color="#333333" size="large" />
              <Text style={{color: '#333333', fontSize: 30, marginTop: 10}}>
                Processing
              </Text>
            </View>
          </View>
        </View>
      );
    }
    return (
      <>
        {loadingState}
        <SafeAreaView style={[styles.overlay]}>
          {this.renderScannerControls()}
        </SafeAreaView>
      </>
    );
  }
  ///////////////////////////////////////////////////////////////////////
  // Renders either the camera view, a loading state, or an error message
  // letting the user know why camera use is not allowed
  //
  renderScannerView() {
    log.debug('InvoiceScanner: renderScannerView()');
    if (this.state.showScannerView) {
      // CAMERA AVAILABLE
      const previewSize = this.getPreviewSize();
      let rectangleOverlay = null;
      if (!this.state.isLoadingScanner && !this.state.isProcessingImage) {
        rectangleOverlay = (         c
          // <RectangleOverlay
          //   detectedRectangle={this.state.detectedRectangle}
          //   previewRatio={previewSize}
          //   backgroundColor="rgba(255,181,6, 0.2)"
          //   borderColor="green"
          //   borderWidth={4}

            // reh : already here:
            // == These let you auto capture and change the overlay style on detection ==
            // detectedBackgroundColor="rgba(255,181,6, 0.3)"
            // detectedBorderWidth={6}
            // detectedBorderColor="rgb(255,218,124)"
            // onDetectedCapture={this.capture}
            // allowDetection

          // />
        );
      }
      return (
        <View
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0)', // set the background color on here because for some reason the view doesn't line up correctly otherwise.
            position: 'relative',
            marginTop: previewSize.marginTop,
            marginLeft: previewSize.marginLeft,
            height: `${previewSize.height * 100}%`,
            width: `${previewSize.width * 100}%`,
          }}>
          {/* <Scanner
            onPictureTaken={this.onPictureTaken}
            onPictureProcessed={this.onPictureProcessed}
            enableTorch={this.state.flashEnabled}
            filterId={this.state.filterId}
            ref={this.camera}
            capturedQuality={1.0}
            onRectangleDetected={({detectedRectangle}) =>
              this.setState({detectedRectangle})
            }
            onDeviceSetup={this.onDeviceSetup}
            onTorchChanged={({enabled}) =>
              this.setState({flashEnabled: enabled})
            }
            style={styles.scanner}
          /> */}
          {rectangleOverlay}
          <Animated.View
            style={{
              ...styles.overlay,
              backgroundColor: 'white',
              opacity: this.state.overlayFlashOpacity,
            }}
          />
          {this.renderScannerOverlay()}
        </View>
      );
    }
    let message = null;
    if (this.state.isLoadingScanner) {
      // CAMERA NOT AVAILABLE: LOADING
      message = (
        <View style={styles.overlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="white" />
            <Text style={styles.loadingCameraMessage}>Loading Camera</Text>
          </View>
        </View>
      );
    } else {
      // CAMERA NOT AVAILABLE: NOT ALLOWED
      message = (
        <Text style={styles.cameraNotAvailableText}>
          {this.getCameraDisabledMessage()}
        </Text>
      );
    }
    return (
      // CAMERA NOT AVAILABLE
      <View style={styles.cameraNotAvailableContainer}>{message}</View>
    );
  }
  renderDocumentDisplay() {
    log.debug('InvoiceScanner: renderDocumentDisplay()');
    // const screenWidth = Dimensions.get('screen').width;
    // const screenHeight = Dimensions.get('screen').height;

    const request = (
      <SafeAreaView>
        <Image
          // reh
          width={500}
          height={500}
          // width={screenWidth}
          // height={screenHeight}
          source={{uri: this.state.imageCachePath}}
        />
        <View style={styles.buttonRightContainer}>
          <View style={styles.submitRejectButtonGroup}>
            <TouchableOpacity
              style={styles.button}
              // User likes the image.
              onPress={(_event) => {
                this.setState({isDisplayDocumentMode: false});
                // reh
                // this.createInvoice(this.state.imageCachePath);
              }}
              activeOpacity={0.4}>
              <Icon name="md-checkmark" style={styles.buttonIconAccept} />
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              // User doesn't like the image.
              onPress={(_event) => {
                this.setState({isDisplayDocumentMode: false});
              }}
              activeOpacity={0.4}>
              <Icon name="md-close" style={styles.buttonIconReject} />
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
    return request;
  }
  render() {
    log.debug('InvoiceScanner: render()');
    return (
      <View
        // style={styles.container}
        onLayout={event => {
          // This is used to detect multi tasking mode on iOS/iPad
          // Camera use is not allowed
          if (this.state.didLoadInitialLayout && Platform.OS === 'ios') {
            const screenWidth = Dimensions.get('screen').width;
            const isMultiTasking =
              Math.round(event.nativeEvent.layout.width) <
              Math.round(screenWidth);
            if (isMultiTasking) {
              this.setState({isMultiTasking: true, isLoadingScanner: false});
            } else {
              this.setState({isMultiTasking: false});
            }
          } else {
            this.setState({didLoadInitialLayout: true});
          }
        }}>
        <StatusBar
          backgroundColor="pink"
          barStyle="light-content"
          hidden={Platform.OS === 'ios'}
        />
        {this.state.isDisplayDocumentMode
          ? this.renderDocumentDisplay()
          : this.renderScannerView()}
      </View>
    );
  }
}
