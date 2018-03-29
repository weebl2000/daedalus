// @flow
import { observable, action, runInAction } from 'mobx';
import { get, chunk } from 'lodash';
import WalletStore from '../WalletStore';
import Wallet from '../../domains/Wallet';
import { matchRoute, buildRoute } from '../../utils/routing';
import { i18nContext } from '../../utils/i18nContext';
import Request from '.././lib/LocalizedRequest';
import { ROUTES } from '../../routes-config';
import { mnemonicToSeedHex } from '../../api/ada/lib/utils';
import WalletAddDialog from '../../components/wallet/WalletAddDialog';
import { downloadPaperWalletCertificate } from '../../utils/paperWalletPdfGenerator';
import type { walletExportTypeChoices } from '../../types/walletExportTypes';
import type { WalletImportFromFileParams } from '../../actions/ada/wallets-actions';
import type { ImportWalletFromFileResponse } from '../../api/ada/index';
import type {
  CreateTransactionResponse, CreateWalletResponse, DeleteWalletResponse,
  GetWalletsResponse, RestoreWalletResponse,
  GetWalletRecoveryPhraseResponse, GetWalletCertificateRecoveryPhraseResponse,
  GetWalletRecoveryPhraseFromCertificateResponse, GetWalletCertificateAdditionalMnemonicsResponse,
} from '../../api/common';

export default class AdaWalletsStore extends WalletStore {

  // REQUESTS
  /* eslint-disable max-len */
  @observable walletsRequest: Request<GetWalletsResponse> = new Request(this.api.ada.getWallets);
  @observable importFromFileRequest: Request<ImportWalletFromFileResponse> = new Request(this.api.ada.importWalletFromFile);
  @observable createWalletRequest: Request<CreateWalletResponse> = new Request(this.api.ada.createWallet);
  @observable getWalletAddressesRequest: Request<any> = new Request(this.api.ada.getAddresses);
  @observable deleteWalletRequest: Request<DeleteWalletResponse> = new Request(this.api.ada.deleteWallet);
  @observable sendMoneyRequest: Request<CreateTransactionResponse> = new Request(this.api.ada.createTransaction);
  @observable getWalletRecoveryPhraseRequest: Request<GetWalletRecoveryPhraseResponse> = new Request(this.api.ada.getWalletRecoveryPhrase);
  @observable getWalletCertificateAdditionalMnemonicsRequest: Request<GetWalletCertificateAdditionalMnemonicsResponse> = new Request(this.api.ada.getWalletCertificateAdditionalMnemonics);
  @observable getWalletCertificateRecoveryPhraseRequest: Request<GetWalletCertificateRecoveryPhraseResponse> = new Request(this.api.ada.getWalletCertificateRecoveryPhrase);
  @observable getWalletRecoveryPhraseFromCertificateRequest: Request<GetWalletRecoveryPhraseFromCertificateResponse> = new Request(this.api.ada.getWalletRecoveryPhraseFromCertificate);
  @observable restoreRequest: Request<RestoreWalletResponse> = new Request(this.api.ada.restoreWallet);
  /* eslint-enable max-len */

  @observable walletExportType: walletExportTypeChoices = 'paperWallet';
  @observable walletExportMnemonic = 'marine joke dry silk ticket thing sugar stereo aim';
  @observable createPaperWalletCertificateStep = 0;
  @observable walletCertificatePassword = null;
  @observable walletCertificateAddress = null;
  @observable walletCertificateRecoveryPhrase = null;
  @observable walletCertificateHasError = false;
  @observable generatingCertificateInProgress = false;
  @observable certificateStep = null;
  @observable certificateTemplate = null;
  @observable additionalMnemonicWords = null;

  setup() {
    super.setup();
    const { router, walletBackup, ada } = this.actions;
    const { wallets } = ada;
    wallets.createWallet.listen(this._create);
    wallets.deleteWallet.listen(this._delete);
    wallets.sendMoney.listen(this._sendMoney);
    wallets.restoreWallet.listen(this._restoreWallet);
    wallets.importWalletFromFile.listen(this._importWalletFromFile);
    wallets.chooseWalletExportType.listen(this._chooseWalletExportType);
    wallets.generateCertificate.listen(this._generateCertificate);
    wallets.verifyCertificate.listen(this._verifyCertificate);
    wallets.updateCertificateStep.listen(this._updateCertificateStep);
    wallets.closeCertificateGeneration.listen(this._closeCertificateGeneration);
    wallets.setCertificateTemplate.listen(this._setCertificateTemplate);
    wallets.finishCertificate.listen(this._finishCertificate);
    router.goToRoute.listen(this._onRouteChange);
    walletBackup.finishWalletBackup.listen(this._finishCreation);
  }

  _sendMoney = async (transactionDetails: {
    receiver: string,
    amount: string,
    password: ?string,
  }) => {
    const wallet = this.active;
    if (!wallet) throw new Error('Active wallet required before sending.');
    const accountId = this.stores.ada.addresses._getAccountIdByWalletId(wallet.id);
    if (!accountId) throw new Error('Active account required before sending.');
    await this.sendMoneyRequest.execute({
      ...transactionDetails,
      sender: accountId,
    });
    this.refreshWalletsData();
    this.actions.dialogs.closeActiveDialog.trigger();
    this.sendMoneyRequest.reset();
    this.goToWalletRoute(wallet.id);
  };

  isValidAddress = (address: string) => this.api.ada.isValidAddress(address);

  isValidMnemonic = (mnemonic: string) => this.api.ada.isValidMnemonic(mnemonic);

  isValidCertificateMnemonic = (
    mnemonic: string,
  ) => this.api.ada.isValidCertificateMnemonic(mnemonic);

  // TODO - call endpoint to check if private key is valid
  isValidPrivateKey = () => { return true; }; // eslint-disable-line

  @action refreshWalletsData = async () => {
    if (this.stores.networkStatus.isConnected) {
      const result = await this.walletsRequest.execute().promise;
      if (!result) return;
      runInAction('refresh active wallet', () => {
        if (this.active) {
          this._setActiveWallet({ walletId: this.active.id });
        }
      });
      runInAction('refresh address data', () => {
        const walletIds = result.map((wallet: Wallet) => wallet.id);
        this.stores.ada.addresses.addressesRequests = walletIds.map(walletId => ({
          walletId,
          allRequest: this.stores.ada.addresses._getAddressesAllRequest(walletId),
        }));
        this.stores.ada.addresses._refreshAddresses();
      });
      runInAction('refresh transaction data', () => {
        const walletIds = result.map((wallet: Wallet) => wallet.id);
        this.stores.ada.transactions.transactionsRequests = walletIds.map(walletId => ({
          walletId,
          recentRequest: this.stores.ada.transactions._getTransactionsRecentRequest(walletId),
          allRequest: this.stores.ada.transactions._getTransactionsAllRequest(walletId),
        }));
        this.stores.ada.transactions._refreshTransactionData();
      });
    }
  };

  @action _setIsRestoreActive = (active: boolean) => {
    this.isRestoreActive = active;
  };

  @action _restoreWallet = async (params: {
    recoveryPhrase: string,
    walletName: string,
    walletPassword: ?string,
    type: string,
  }) => {
    const data = {
      recoveryPhrase: params.recoveryPhrase,
      walletName: params.walletName,
      walletPassword: params.walletPassword,
    };

    if (params.type === 'certificate') {
      // split recovery phrase to 15 (scrambled mnemonics) + 9 (mnemonics seed) mnemonics
      const recoveryPhraseArray = params.recoveryPhrase.split(' ');
      const chunked = chunk(recoveryPhraseArray, 15);
      const scrambledInput = chunked[0]; // first 15 mnemonics
      const certificatePassword = chunked[1]; // last 9 mnemonics
      const spendingPassword = mnemonicToSeedHex(certificatePassword.join(' '));

      // Unscramble 15-word wallet certificate mnemonic to 12-word mnemonic
      const unscrambledRecoveryPhrase: ?GetWalletCertificateRecoveryPhraseResponse = await (
        this.getWalletRecoveryPhraseFromCertificateRequest.execute({
          passphrase: spendingPassword,
          scrambledInput: scrambledInput.join(' '),
        }).promise
      );

      if (unscrambledRecoveryPhrase) {
        data.recoveryPhrase = unscrambledRecoveryPhrase;
      } else {
        throw new Error('Invalid mnemonic');
      }
    }

    this.restoreRequest.reset();
    this._setIsRestoreActive(true);
    // Hide restore wallet dialog some time after restore has been started
    // ...or keep it open in case it has errored out (so that error message can be shown)
    setTimeout(() => {
      if (!this.restoreRequest.isExecuting) this._setIsRestoreActive(false);
      if (!this.restoreRequest.isError) this._toggleAddWalletDialogOnActiveRestoreOrImport();
    }, this.WAIT_FOR_SERVER_ERROR_TIME);

    const restoredWallet = await this.restoreRequest.execute(data).promise;
    setTimeout(() => {
      this._setIsRestoreActive(false);
      this.actions.dialogs.closeActiveDialog.trigger();
    }, this.MIN_NOTIFICATION_TIME);
    if (!restoredWallet) throw new Error('Restored wallet was not received correctly');
    this.restoreRequest.reset();
    await this._patchWalletRequestWithNewWallet(restoredWallet);
    this.refreshWalletsData();
  };

  @action _setIsImportActive = (active: boolean) => {
    this.isImportActive = active;
  };

  @action _importWalletFromFile = async (params: WalletImportFromFileParams) => {
    this.importFromFileRequest.reset();
    this._setIsImportActive(true);
    // Hide import wallet dialog some time after import has been started
    // ...or keep it open in case it has errored out (so that error message can be shown)
    setTimeout(() => {
      if (!this.importFromFileRequest.isExecuting) this._setIsImportActive(false);
      if (!this.importFromFileRequest.isError) this._toggleAddWalletDialogOnActiveRestoreOrImport();
    }, this.WAIT_FOR_SERVER_ERROR_TIME);

    const { filePath, walletName, walletPassword } = params;
    const importedWallet = await this.importFromFileRequest.execute({
      filePath, walletName, walletPassword,
    }).promise;
    setTimeout(() => {
      this._setIsImportActive(false);
      this.actions.dialogs.closeActiveDialog.trigger();
    }, this.MIN_NOTIFICATION_TIME);
    if (!importedWallet) throw new Error('Imported wallet was not received correctly');
    this.importFromFileRequest.reset();
    await this._patchWalletRequestWithNewWallet(importedWallet);
    this.refreshWalletsData();
  };

  @action _setActiveWallet = ({ walletId }: { walletId: string }) => {
    if (this.hasAnyWallets) {
      const activeWalletId = this.active ? this.active.id : null;
      const activeWalletChange = activeWalletId !== walletId;
      if (activeWalletChange) this.stores.ada.addresses.lastGeneratedAddress = null;
      this.active = this.all.find(wallet => wallet.id === walletId);
    }
  };

  @action _unsetActiveWallet = () => {
    this.active = null;
    this.stores.ada.addresses.lastGeneratedAddress = null;
  };

  @action _onRouteChange = (options: { route: string, params: ?Object }) => {
    // Reset the send request anytime we visit the send page (e.g: to remove any previous errors)
    if (matchRoute(ROUTES.WALLETS.SEND, buildRoute(options.route, options.params))) {
      this.sendMoneyRequest.reset();
    }
  };

  @action _chooseWalletExportType = (params: {
    walletExportType: walletExportTypeChoices,
  }) => {
    if (this.walletExportType !== params.walletExportType) {
      this.walletExportType = params.walletExportType;
    }
  };

  _generateCertificate = async (params: {
    filePath: string,
  }) => {
    try {
      // Stop polling
      this.actions.networkStatus.stopPoller.trigger();

      // Set inProgress state to show spinner if is needed
      this._updateCertificateCreationState(true);

      // Genereate 12-word mnemonic
      const recoveryPhrase: GetWalletRecoveryPhraseResponse = await (
        this.getWalletRecoveryPhraseRequest.execute().promise
      );

      // Generate 9-words (additional) mnemonic
      const additionalMnemonicWords: GetWalletCertificateAdditionalMnemonicsResponse = await (
        this.getWalletCertificateAdditionalMnemonicsRequest.execute().promise
      );
      this.additionalMnemonicWords = additionalMnemonicWords.join(' ');

      // Generate spending password from 9-word mnemonic and save to store
      const spendingPassword = mnemonicToSeedHex(this.additionalMnemonicWords);
      this.walletCertificatePassword = spendingPassword;

      // Generate paper wallet scrambled mnemonic
      const walletCertificateRecoveryPhrase: ?GetWalletCertificateRecoveryPhraseResponse = await (
        this.getWalletCertificateRecoveryPhraseRequest.execute({
          passphrase: spendingPassword,
          input: recoveryPhrase.join(' '),
        }).promise
      );
      this.walletCertificateRecoveryPhrase = walletCertificateRecoveryPhrase
        ? walletCertificateRecoveryPhrase.join(' ')
        : '';

      // Create temporary wallet
      const walletData = {
        name: 'Paper Wallet',
        mnemonic: recoveryPhrase.join(' '),
        password: spendingPassword,
      };
      const wallet = await this.createWalletRequest.execute(walletData).promise;

      // Get temporary wallet address
      let walletAddresses;
      if (wallet) {
        walletAddresses = await this.getWalletAddressesRequest.execute({
          walletId: wallet.id,
        }).promise;

        // delete temporary wallet
        await this.deleteWalletRequest.execute({ walletId: wallet.id });
      }

      // Set wallet certificate address
      let walletAddress;
      if (walletAddresses) {
        walletAddress = get(walletAddresses, ['addresses', '0', 'id'], null);
        this.walletCertificateAddress = walletAddress;
      }

      // download pdf certificate
      this._downloadCertificate(
        walletAddress,
        walletCertificateRecoveryPhrase,
        params.filePath,
      );
    } catch (error) {
      throw error;
    } finally {
      this.actions.networkStatus.restartPoller.trigger();
    }
  };

  _downloadCertificate = action((
    address: string,
    recoveryPhrase: Array<string>,
    filePath: string,
  ) => {
    setTimeout(() => { // Timeout is used to allow enought time for button text re-rendering
      const locale = this.stores.profile.currentLocale;
      const intl = i18nContext(locale);

      downloadPaperWalletCertificate({
        address,
        mnemonics: recoveryPhrase,
        intl,
        filePath,
        onSuccess: () => {
          // Reset progress
          this._updateCertificateCreationState(false);
          // Update certificate generator step
          this._updateCertificateStep();
        },
        onError: () => {
          // Reset progress
          this._updateCertificateCreationState(false);
        },
      });
    }, 100);
  });

  _updateCertificateCreationState = action((state: boolean) => {
    this.generatingCertificateInProgress = state;
  });

  @action _verifyCertificate = (params: {
    recoveryPhrase: Array<string>
  }) => {
    const { recoveryPhrase } = params;

    let fullRecoveryPhrase;
    if (this.walletCertificateRecoveryPhrase && this.additionalMnemonicWords) {
      fullRecoveryPhrase = `${this.walletCertificateRecoveryPhrase} ${this.additionalMnemonicWords}`;
    }

    if (!fullRecoveryPhrase || (fullRecoveryPhrase !== recoveryPhrase.join(' '))) {
      this.walletCertificateHasError = true;
    } else {
      this.walletCertificateHasError = false;
      this._updateCertificateStep();
    }
  };

  @action _setCertificateTemplate = (params: {
    selectedTemplate: string,
  }) => {
    this.certificateTemplate = params.selectedTemplate;
    this._updateCertificateStep();
  };

  @action _finishCertificate = () => {
    this._closeCertificateGeneration();
  };

  @action _updateCertificateStep = (isBack: boolean = false) => {
    const currrentCertificateStep = this.certificateStep || 0;
    this.certificateStep = isBack ? currrentCertificateStep - 1 : currrentCertificateStep + 1;
  };

  @action _closeCertificateGeneration = () => {
    this.actions.dialogs.closeActiveDialog.trigger();
    this._resetCertificateData();
  };

  @action _resetCertificateData = () => {
    this.walletCertificatePassword = null;
    this.walletCertificateAddress = null;
    this.walletCertificateRecoveryPhrase = null;
    this.walletCertificateHasError = false;
    this.generatingCertificateInProgress = false;
    this.certificateTemplate = false;
    this.certificateStep = null;
  };

  // =================== PRIVATE API ==================== //

  _toggleAddWalletDialogOnActiveRestoreOrImport = () => {
    // Once restore/import is under way we need to either:
    // A) show the 'Add wallet' dialog (in case we don't have any wallets) or
    // B) just close the active dialog and unblock the UI
    if (this.hasLoadedWallets && !this.hasAnyWallets) {
      this.actions.dialogs.open.trigger({ dialog: WalletAddDialog });
    } else {
      this.actions.dialogs.closeActiveDialog.trigger();
    }
  };

}
