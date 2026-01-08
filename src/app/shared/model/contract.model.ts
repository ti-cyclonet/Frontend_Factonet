export interface Contract {
  id: string;
  code: string;
  value: string;
  mode: string;
  payday: number;
  startDate: string;
  endDate: string;
  status: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: ContractUser;
  package: ContractPackage;
}

export interface ContractUser {
  id: string;
  strUserName: string;
  code: string;
  strPassword: string;
  mustChangePassword: boolean;
  lastPasswordChange: string;
  strStatus: string;
  dtmCreateDate: string;
  dtmLatestUpdateDate: string;
  deletedAt: string | null;
  dependentOnId: string | null;
  basicData: BasicData;
}

export interface BasicData {
  id: string;
  strPersonType: 'J' | 'N';
  strStatus: string;
  documentTypeId?: string;
  documentNumber?: string;
  documentType?: {
    id: string;
    description: string;
    documentType: string;
  };
  naturalPersonData?: NaturalPersonData;
  legalEntityData?: LegalEntityData;
}

export interface NaturalPersonData {
  id: string;
  firstName: string;
  secondName?: string;
  firstSurname: string;
  secondSurname?: string;
  birthDate: string;
  maritalStatus: string;
  sex: string;
}

export interface LegalEntityData {
  id: string;
  businessName: string;
  webSite?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export interface ContractPackage {
  id: string;
  code: string;
  name: string;
  description: string;
  configurations?: PackageConfiguration[];
}

export interface PackageConfiguration {
  id: string;
  price: number;
  totalAccount: number;
  rolId: string;
  packageId: string;
  rol: {
    id: string;
    code: string;
    strName: string;
    strDescription1: string;
    strDescription2: string;
  };
}