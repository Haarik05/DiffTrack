
import {DiffSchema, DiffEngine} from "./index.ts";
  let previousValue = {
    countryCode: "SE",
    partnerId: "8113d3f8403b380409",
    controlFields: {
      showProductCatalogue: false,
      storeId: "822c0936441010090f",
      merchantId: "822c087a0799d8030e",
      showBankDetails: true,
      generateShortLink: false,
    },
    corporateId: "5569345274",
    companyName: "Swaniawski Group",
    store: {
      name: "Jacques.Schmitt",
      email: "sathish@sur.se",
      phoneNumber: {
        code: "46",
        number: "23423423",
      },
      address: {
        careOf: "Dietrich Row",
        addressLine1: "182",
        addressLine2: "Suite 152",
        addressLine3: "Lao People's Democratic Republic",
        city: "New Cordell",
        countryCode: "SE",
        postalCode:<any> "11121",
      },
    },
    mccInfo: {
      code: 4121,
      description: "For testing",
    },
    openingInfo: {
      isOpenAllYear: true,
      isSeasonalOpen: false,
      isStoreOpenAtNight: false,
      monthsOpen: [6,7,8,9,0],
      reasonForOpeningAtNight: null,
    },
    // giftCards: {
    //   amountPerYear: null,
    //   averageValidDays: null,
    // }, -- addition
    prePayments: {
      salesPercentPerYear: null,
      averageDeliveryTimeInDays: null,
    },
    fundsInfo: {
      averageTransactionValuePerDay: 40000,
      currency: null,
      estimatedAmountPerTransaction: 30000,
      estimatedAmountPerYear: 200000,
      // estimatedFrequencyOfTransactions: "Multiple times per day", -- addition
      estimatedNoOfDailyTransactions: null,
      priceOfMostExpensiveItemSold: 300000,
    },
    applicantInfo: {
      name: "Swaniawski Group",
      email: "sathish@su.se", 
    },
    storeLevelPaymentSegregation: false,
    // merchant: null,
    // bankInfo: null,
    isGiftCardsAllowed: false,
    isPrepaymentsAllowed: false,
    otherSignatoryInfo: [
      {
        "name": " Jacquelyn Durgan Anita",
        "isSigned": true,
        "address": [1,2,3,4,5]
      },
      {
        "name": " Miss Ida Boyer Harry",
        "isSigned": true
      },
      {
        "name": " Colleen Kuvalis Olin",
        "isSigned": true
      }
    ],
    otherUboInfo: [
      {
        "name": "Wade Hills",
        "isSigned": true
      }
    ],
    products: null,
    selfDeclaration: null,
    preSelectProducts: null,
    localeSelected: "en",
    applicationType: "RENEWAL",
    status: "APPLICATION_INITIATED",
    kycId: null,
  };
  
  // previousValue.store.address.postalCode = previousValue.store; //circular reference;
  
   let latest = {
    countryCode: "SE",
    partnerId: "8113d3f8403b380409",
    controlFields: {
      showProductCatalogue: false,
      storeId: "822c0936441010090f",
      merchantId: "822c087a0799d8030e",
      showBankDetails: true,
      generateShortLink: false,
    },
    corporateId: "5569345274",
    companyName: "Swaniawski Group",
    store: {
      name: "Jacques.Schmitt",
      email: "sathish@sur.se",
      // phoneNumber: {
      //   code: "46",
      //   number: "23423423",
      // }, --deletion
      address: {
        careOf: "Dietrich Row",
        addressLine1: "182",
        addressLine2: "Suite 152",
        addressLine3: "Lao People's Democratic Republic",
        city: "New Cordell",
        countryCode: "SE",
        postalCode:<any> "11121",
      },
    },
    mccInfo: {
      code: 4121,
      description: "For testing",
    },
    openingInfo: {
      isOpenAllYear: true,
      isSeasonalOpen: false,
      isStoreOpenAtNight: false,
      monthsOpen: [1,2,3,4,5],
      reasonForOpeningAtNight: null,
    },
    giftCards: {
      amountPerYear: null,
      averageValidDays: null,
    },
    prePayments: {
      salesPercentPerYear: null,
      averageDeliveryTimeInDays: null,
    },
    fundsInfo: {
      averageTransactionValuePerDay: 40000,
      currency: null,
      estimatedAmountPerTransaction: 30000,
      estimatedAmountPerYear: 200000,
      estimatedFrequencyOfTransactions: "Multiple times per day",
      estimatedNoOfDailyTransactions: null,
      priceOfMostExpensiveItemSold: 300000,
    },
    // applicantInfo: {
    //   name: "Swaniawski Group",
    //   email: "sathish@su.se",
    // },
    storeLevelPaymentSegregation: false,
    merchant: null,
    bankInfo: null,
    isGiftCardsAllowed: false,
    isPrepaymentsAllowed: false,
    otherSignatoryInfo: [
      {
        "name": " Jacquelyn Durgan Anita",
        "isSigned": true,
        "address":[1,2,3,4,5, 6]
      },
      {
        "name": " Miss Ida Boyer Harry",
        "isSigned": true
      },
      {
        "name": " Colleen Kuvalis Olin",
        "isSigned": true
      }
    ],
    otherUboInfo: [
      {
        "name": "Wade Hills",
        "isSigned": true
      }
    ],
    products: null,
    selfDeclaration: null,
    preSelectProducts: null,
    localeSelected: "en",
    applicationType: "RENEWAL",
    // status: "APPLICATION_INITIATED", -- deletion
    kycId: null,
  };
  
const schema: DiffSchema = {
  otherSignatoryInfo: {
    arrayItemIdentifier: "name",
  },
  otherUboInfo: {
    arrayItemIdentifier: "name"
  },
}


const diff = new DiffEngine({schema});
const result = await diff.callDiffTracker(previousValue, latest, new Object());
console.log(JSON.stringify(result))
