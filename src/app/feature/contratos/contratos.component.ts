import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { ContractPdfService } from '../../shared/services/contract-pdf.service';
import { Contract } from '../../shared/model/contract.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

// Pipe personalizado para reemplazar
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'replace', standalone: true})
export class ReplacePipe implements PipeTransform {
  transform(value: string | null, search: string, replacement: string): string {
    if (!value) return '';
    return value.replace(new RegExp(search, 'g'), replacement);
  }
}

@Component({
  selector: 'app-contratos', 
  standalone: true,
  imports: [CommonModule, ReplacePipe],
  templateUrl: './contratos.component.html', 
  styleUrls: ['./contratos.component.css'] 
})
export class ContratosComponent implements OnInit, OnDestroy { 
  
  // Utilizamos signals para el estado reactivo
  contratos = signal<Contract[]>([]);
  selectedContrato = signal<Contract | null>(null); 
  
  // Bandera para el modal de creación/edición
  isModalOpen = signal(false);
  // Bandera para el modal de confirmación de eliminación (reemplazo de confirm())
  isDeleteConfirmationModalOpen = signal(false);

  // Configuración de notificaciones usando signals
  notifications = signal<Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B'; // A: temporal, B: persistente
    container: 0 | 1; // 0: top-right, 1: bottom-left
    visible: boolean;
  }>>([]);
  
  showOptions = true; // Controla la visibilidad del panel de opciones
  userRol: string | null = null;
  
  private clickListener?: () => void;

  // Propiedad para el contrato del modal
  modalContrato: Contract | null = null;
  
  // Controla la visibilidad de la información detallada del usuario
  showUserDetails = signal(false);
  
  // Controla la visibilidad de la información detallada del paquete
  showPackageDetails = signal(false);
  
  // Controla el estado de generación de PDF
  generatingPDF = signal(false);
  
  // Almacena los contratos que ya tienen PDF generado
  contractsWithPDF = new Set<string>();

  // Estados permitidos para contratos
  contractStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TERMINATED', 'RENEWED', 'DELETED'];
  
  // Control del dropdown de estados
  statusDropdownOpen = signal<string | null>(null);
  statusDropdownPosition = signal<{top: number, left: number}>({top: 0, left: 0});

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService,
    private contractPdfService: ContractPdfService
  ) { 
    // Las signals reemplazan la necesidad de inicializar arrays vacíos aquí
  }

  ngOnInit(): void {
    this.userRol = sessionStorage.getItem('user_rol');
    this.loadContratos();
    
    // Listener para cerrar dropdown al hacer click fuera
    this.clickListener = () => {
      this.closeStatusDropdown();
    };
    document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
    }
  }

  /**
   * Carga contratos desde el backend.
   */
  loadContratos(): void {
    this.factonetService.getContracts().subscribe({
      next: (contratos) => {
        // Ordenar contratos por fecha de inicio (más reciente primero)
        const contratosOrdenados = (contratos || []).sort((a, b) => {
          const dateA = new Date(a.startDate);
          const dateB = new Date(b.startDate);
          return dateB.getTime() - dateA.getTime();
        });
        
        this.contratos.set(contratosOrdenados);
        // Limpiar y actualizar contratos con PDF
        this.contractsWithPDF.clear();
        contratosOrdenados.forEach(contrato => {
          if (contrato.pdfUrl) {
            this.contractsWithPDF.add(contrato.id);
          }
        });
        // Update modalContrato if it's open
        if (this.modalContrato) {
          const updated = contratosOrdenados.find(c => c.id === this.modalContrato!.id);
          if (updated) {
            this.modalContrato = updated;
          }
        }
        if (contratosOrdenados.length > 0) {
          this.showToast('Contracts loaded successfully', 'success', 'A', 0);
        } else {
          this.showToast('No contracts available', 'primary', 'A', 0);
        }
      },
      error: (error) => {
        this.contratos.set([]);
        this.showToast('Error connecting to contracts server', 'danger', 'A', 0);
      }
    });
  }

  /**
   * Abre el modal para añadir un nuevo contrato.
   */
  openContratoModal() { 
    this.isModalOpen.set(true);
    this.showToast('SYSTEM: Opening Contract Creation Interface...', 'primary', 'A', 0);
  }

  /**
   * Muestra los detalles del contrato en el modal.
   */
  viewContrato(contrato: Contract) {
    this.modalContrato = contrato; // Usar propiedad normal en lugar de signal
    this.selectedContrato.set(contrato);
    this.showUserDetails.set(false); // Resetear al abrir modal
    this.showPackageDetails.set(false); // Resetear al abrir modal
    this.showToast(`Viewing contract: ${contrato.code || contrato.id}`, 'primary', 'A', 0);
    
    // Abrir modal programáticamente
    setTimeout(() => {
      const modal = document.getElementById('viewContractModal');
      if (modal) {
        const bootstrapModal = new (window as any).bootstrap.Modal(modal);
        bootstrapModal.show();
      }
    }, 100);
  }

  /**
   * Alterna la visibilidad de los detalles del usuario.
   */
  toggleUserDetails() {
    this.showUserDetails.update(current => !current);
  }

  /**
   * Alterna la visibilidad de los detalles del paquete.
   */
  togglePackageDetails() {
    this.showPackageDetails.update(current => !current);
  }

  /**
   * Genera y descarga el contrato en PDF.
   */
  generateContractPDF(contrato: Contract) {
    // Si ya existe el PDF en Cloudinary, mostrar opciones directamente
    if (contrato.pdfUrl) {
      this.showPDFOptions(contrato);
      return;
    }
    
    // Si no existe PDF, generarlo
    this.generatingPDF.set(true);
    
    Swal.fire({
      title: 'Generando PDF...',
      text: `Creando contrato para ${contrato.code || contrato.id}`,
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // Generar PDF y subirlo al servidor
    this.generateAndUploadPDF(contrato).then(() => {
      this.generatingPDF.set(false);
      // Recargar contratos para obtener la URL actualizada
      this.loadContratos();
      // Actualizar el modalContrato con el pdfUrl para que los botones funcionen sin refrescar
      setTimeout(() => {
        const contratoActualizado = this.contratos().find(c => c.id === contrato.id);
        if (contratoActualizado) {
          // Update the modal contract reference
          if (this.modalContrato && this.modalContrato.id === contrato.id) {
            this.modalContrato = { ...this.modalContrato, pdfUrl: contratoActualizado.pdfUrl };
          }
          this.showPDFOptions(contratoActualizado);
        }
      }, 1000);
    }).catch(error => {
      this.generatingPDF.set(false);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo generar el PDF',
        icon: 'error'
      });
    });
  }

  /**
   * Muestra las opciones disponibles para el PDF.
   */
  private showPDFOptions(contrato: Contract) {
    Swal.fire({
      title: 'PDF Available!',
      text: `Contract ${contrato.code || contrato.id} ready`,
      icon: 'success',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'View PDF',
      denyButtonText: 'Download',
      cancelButtonText: 'Close'
    }).then((result) => {
      if (result.isConfirmed) {
        // Siempre usar modal HTML local
        this.viewContractPDF(contrato);
      } else if (result.isDenied) {
        this.downloadContractPDF(contrato);
      }
    });
  }

  /**
   * Muestra el contrato PDF en un modal.
   */
  private viewContractPDF(contrato: Contract) {
    const contractContent = this.generateContractHTML(contrato);
    
    Swal.fire({
      title: `Contrato ${contrato.code || contrato.id}`,
      html: contractContent,
      width: '80%',
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'contract-modal'
      }
    });
  }

  /**
   * Genera el contenido HTML del contrato.
   */
  private getContractVars(contrato: Contract) {
    const clientName = contrato.user.basicData?.legalEntityData?.businessName ||
      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() ||
      contrato.user.strUserName;
    const docType = contrato.user.basicData?.documentType?.description || 'CC';
    const docNumber = contrato.user.basicData?.documentNumber || '[Número de documento]';
    const contactName = contrato.user.basicData?.legalEntityData?.contactName ||
      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() || clientName;
    const valorNum = typeof contrato.value === 'string' ? parseFloat(contrato.value) : contrato.value;
    const monthlyValue = contrato.mode === 'MONTHLY' ? valorNum / 12 : valorNum;
    const fechaSistema = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const startMonths = contrato.startDate && contrato.endDate
      ? Math.round((new Date(contrato.endDate).getTime() - new Date(contrato.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 12;
    return { clientName, docType, docNumber, contactName, valorNum, monthlyValue, fechaSistema, startMonths };
  }

  private getContractBodyText(contrato: Contract): string {
    const v = this.getContractVars(contrato);
    const pkgDesc = contrato.package.name + ' \u2013 ' + (contrato.package.description || 'Servicio de software');
    const payDay = contrato.payday || 1;
    const monthlyStr = this.numberToWords(Math.round(v.monthlyValue)) + ' pesos ($' + Math.round(v.monthlyValue).toLocaleString('es-CO') + '.oo)';
    return 'Entre los suscritos a saber: 1) CYCLONET S. A. S., sociedad por acciones simplificada identificada con NIT 901.515.884-3, con domicilio en Turbaco, Bol\u00edvar (Colombia), direcci\u00f3n BRR BONANZA MZ 23 LT 30 y correo electr\u00f3nico CYCLONETSAS@GMAIL.COM, quien para efectos del presente contrato se denominar\u00e1 el \u201cCONTRATISTA\u201d. 2) ' + v.clientName + ', identificado con ' + v.docType + ' ' + v.docNumber + ', quien para efectos del presente contrato se denominar\u00e1 el CONTRATANTE. El CONTRATISTA y el CONTRATANTE, conjuntamente denominados las \u201cPartes\u201d e individualmente la \u201cParte\u201d, acuerdan celebrar el presente Contrato de Prestaci\u00f3n de Servicios bajo la modalidad Software as a Service (SaaS) con sujeci\u00f3n a las siguientes cl\u00e1usulas: '
    + 'CL\u00c1USULA 1. DEFINICIONES: SaaS o Software as a Service: Modelo de prestaci\u00f3n de servicios de software en el que el acceso se realiza a trav\u00e9s de internet, sin entrega de c\u00f3digo fuente, y cuya infraestructura subyacente es administrada por el proveedor de nube. Software: La soluci\u00f3n tecnol\u00f3gica InOut y dem\u00e1s componentes, m\u00f3dulos, APIs, configuraciones, manuales y documentaci\u00f3n asociada de titularidad del CONTRATISTA. Servicio: El acceso y uso del Software en la nube, junto con las actividades de operaci\u00f3n y soporte b\u00e1sico descritas en este contrato. Datos del Contratante: Informaci\u00f3n y contenidos que el CONTRATANTE cargue o genere mediante el uso del Servicio. Mantenimiento: Actividades de actualizaci\u00f3n, mejoras y correcciones evolutivas o de seguridad que el CONTRATISTA pueda realizar para asegurar la continuidad del Servicio. '
    + 'CL\u00c1USULA 2. OBJETO: El CONTRATISTA proveer\u00e1 al CONTRATANTE acceso y uso del Software InOut bajo el modelo de Software as a Service (SaaS), alojado en infraestructura de Amazon Web Services (AWS), regi\u00f3n us-east-1 (Norte de Virginia, Estados Unidos), incluyendo autenticaci\u00f3n, operaci\u00f3n y soporte b\u00e1sico, conforme al servicio contratado ' + pkgDesc + '. '
    + 'CL\u00c1USULA 3. ALCANCE DEL SERVICIO Y ENTREGABLES: 3.1 Alcance. El Servicio comprende: (a) provisi\u00f3n de acceso al Software v\u00eda web; (b) operaci\u00f3n continua en la nube; (c) soporte b\u00e1sico en horario h\u00e1bil; (d) gesti\u00f3n de cuentas/usuarios; (e) actualizaciones t\u00e9cnicas razonables. No comprende desarrollos a la medida, integraciones espec\u00edficas, ni servicios profesionales distintos a los aqu\u00ed definidos, los cuales requerir\u00e1n contrato o anexo independiente. 3.2 Entregables. Sin perjuicio de la naturaleza cont\u00ednua del Servicio, se consideran entregables: (i) habilitaci\u00f3n de cuentas y roles; (ii) acceso a ambiente productivo; (iii) documentaci\u00f3n de usuario y t\u00e9cnico-administrativa en medio digital; (iv) informes b\u00e1sicos de uso. '
    + 'CL\u00c1USULA 4. VIGENCIA: El presente contrato tendr\u00e1 una vigencia desde el ' + contrato.startDate + ' hasta el ' + contrato.endDate + ' - ' + v.startMonths + ' meses contados a partir de la fecha de su firma o del acta de inicio, lo que ocurra primero. Se entender\u00e1 prorrogado autom\u00e1ticamente por periodos iguales, salvo aviso en contrario con al menos treinta (30) d\u00edas de anticipaci\u00f3n al vencimiento. '
    + 'CL\u00c1USULA 5. LICENCIA DE USO (ARRIENDO): El CONTRATISTA otorga al CONTRATANTE una licencia de uso limitada, no exclusiva, no transferible, revocable y sin derecho a sublicenciar, para acceder y utilizar el Software durante la vigencia del contrato. No se transfiere propiedad intelectual ni se entrega c\u00f3digo fuente. Cualquier desarrollo a la medida se entender\u00e1 regido por instrumentos contractuales separados. '
    + 'CL\u00c1USULA 6. PROPIEDAD INTELECTUAL: El Software, su c\u00f3digo, arquitectura, interfaces, documentaci\u00f3n y marcas son y seguir\u00e1n siendo de titularidad exclusiva del CONTRATISTA, protegidos por la Ley 23 de 1982 y la Decisi\u00f3n Andina 351 de 1993. El CONTRATANTE se abstendr\u00e1 de realizar ingenier\u00eda inversa, descompilaci\u00f3n, extracci\u00f3n o cualquier acto que vulnere tales derechos. '
    + 'CL\u00c1USULA 7. NIVELES DE SERVICIO (SLA) Y MANTENIMIENTO: 7.1 Soporte. El CONTRATISTA atender\u00e1 solicitudes de soporte por correo y mesa de ayuda en horario lunes a viernes de 8:00 a.m. a 6:00 p.m. (hora Colombia), excluidos festivos nacionales. No se pactan cr\u00e9ditos econ\u00f3micos por niveles de servicio. 7.2 Mantenimiento y ventanas. El CONTRATISTA podr\u00e1 realizar mantenimientos programados notificando con al menos 48 horas de antelaci\u00f3n, procurando minimizar indisponibilidades. '
    + 'CL\u00c1USULA 8. SEGURIDAD, RESPALDOS Y CONTINUIDAD: El CONTRATISTA aplicar\u00e1 medidas razonables de seguridad de la informaci\u00f3n propias del entorno Cloud de AWS. Mantendr\u00e1 copias de respaldo peri\u00f3dicas y procedimientos de restauraci\u00f3n razonables. En caso de incidente que afecte materialmente la confidencialidad, integridad o disponibilidad, notificar\u00e1 al CONTRATANTE dentro de un plazo razonable. '
    + 'CL\u00c1USULA 9. PROTECCI\u00d3N DE DATOS PERSONALES Y TRANSFERENCIA INTERNACIONAL: Las Partes cumplir\u00e1n la Ley 1581 de 2012 y su reglamentaci\u00f3n (Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015). El CONTRATANTE autoriza de forma expresa la transferencia y tratamiento internacional de Datos del Contratante en la regi\u00f3n us-east-1 de AWS (Estados Unidos) para la efectiva prestaci\u00f3n del Servicio. El CONTRATISTA actuar\u00e1 como Encargado o Responsable seg\u00fan corresponda y dispondr\u00e1 de una Pol\u00edtica de Tratamiento accesible para los titulares. '
    + 'CL\u00c1USULA 10. CONFIDENCIALIDAD: La informaci\u00f3n no p\u00fablica que una Parte entregue a la otra tendr\u00e1 el car\u00e1cter de confidencial. Las Partes se obligan a no divulgarla a terceros ni utilizarla para fines distintos a la ejecuci\u00f3n del contrato. Esta obligaci\u00f3n subsistir\u00e1 por cinco (5) a\u00f1os despu\u00e9s de terminado el contrato. '
    + 'CL\u00c1USULA 11. PRECIO, FACTURACI\u00d3N, MORA Y SUSPENSI\u00d3N: 11.1. Valor y forma de pago. El CONTRATANTE pagar\u00e1 al CONTRATISTA la suma de ' + monthlyStr + ' mensuales, pagaderos los d\u00edas ' + payDay + ' de cada mes, durante la vigencia del presente contrato. 11.2. Exclusi\u00f3n de IVA. El servicio de computaci\u00f3n en la nube aqu\u00ed pactado se encuentra excluido del IVA de conformidad con el numeral 21 del art\u00edculo 476 del Estatuto Tributario. El CONTRATISTA facturar\u00e1 sin IVA indicando: \u201cServicio excluido de IVA \u2013 Art. 476-21 E.T.\u201d. Cualquier retenci\u00f3n en la fuente aplicable ser\u00e1 practicada por el CONTRATANTE conforme a las normas vigentes. 11.3. Facturaci\u00f3n. Cinco (5) d\u00edas calendario antes de la fecha de pago pactada, el CONTRATISTA generar\u00e1 y remitir\u00e1 al CONTRATANTE, v\u00eda correo electr\u00f3nico, la factura correspondiente al per\u00edodo mensual en curso. 11.4. Notificaciones de cobro. El proceso de cobro se realizar\u00e1 de la siguiente manera: Primera notificaci\u00f3n: El d\u00eda ' + payDay + ' (fecha de pago), se enviar\u00e1 un correo electr\u00f3nico recordando al CONTRATANTE la obligaci\u00f3n de pago. Segunda notificaci\u00f3n: Transcurridos cinco (5) d\u00edas calendario despu\u00e9s de la fecha de pago sin que se haya registrado el pago, se enviar\u00e1 un segundo recordatorio. A partir de este momento, se aplicar\u00e1 un recargo por mora. 11.5. Suspensi\u00f3n del servicio. Si transcurridos cinco (5) d\u00edas calendario adicionales despu\u00e9s de la segunda notificaci\u00f3n el CONTRATANTE no ha realizado el pago, el CONTRATISTA proceder\u00e1 a: a) Suspender el acceso al servicio de todas las cuentas de usuario asociadas al CONTRATANTE. b) Iniciar el proceso de cobro coactivo por la totalidad de los valores adeudados, incluyendo los recargos por mora generados. 11.6. Reactivaci\u00f3n del servicio. La reactivaci\u00f3n del servicio estar\u00e1 sujeta al pago total de las facturas pendientes, los recargos por mora y, de ser aplicable, un cargo de reactivaci\u00f3n. El CONTRATISTA dispondr\u00e1 de hasta tres (3) d\u00edas h\u00e1biles para restablecer el servicio una vez verificado el pago. PAR\u00c1GRAFO PRIMERO. Los porcentajes de recargo por mora ser\u00e1n los vigentes al momento de la causaci\u00f3n y estar\u00e1n disponibles para consulta del CONTRATANTE en la plataforma. PAR\u00c1GRAFO SEGUNDO. La suspensi\u00f3n del servicio por mora no exime al CONTRATANTE del pago de las mensualidades causadas durante el per\u00edodo de suspensi\u00f3n, salvo que se haya dado por terminado el contrato conforme a la Cl\u00e1usula 15 del presente documento. '
    + 'CL\u00c1USULA 12. LIMITACI\u00d3N DE RESPONSABILIDAD: Salvo dolo o culpa grave, la responsabilidad total acumulada del CONTRATISTA frente al CONTRATANTE por cualquier causa relacionada con este contrato no exceder\u00e1 el monto efectivamente pagado por el CONTRATANTE durante los \u00faltimos doce (12) meses previos al evento que dio lugar a la reclamaci\u00f3n. En ning\u00fan caso el CONTRATISTA responder\u00e1 por lucro cesante, p\u00e9rdida de datos (salvo que derive de su dolo), ni da\u00f1os indirectos o consecuenciales. '
    + 'CL\u00c1USULA 13. CUMPLIMIENTO NORMATIVO Y FIRMA ELECTR\u00d3NICA: Las Partes reconocen la validez de los mensajes de datos, documentos y firmas electr\u00f3nicas de acuerdo con la Ley 527 de 1999 y el Decreto 2364 de 2012. Pueden utilizar plataformas de firma electr\u00f3nica para la formalizaci\u00f3n de este contrato y sus anexos. '
    + 'CL\u00c1USULA 14. CESI\u00d3N: El CONTRATANTE no podr\u00e1 ceder el contrato ni sus derechos/licencias sin autorizaci\u00f3n previa y escrita del CONTRATISTA. El CONTRATISTA podr\u00e1 ceder este contrato a afiliadas o en el marco de reorganizaciones empresariales, informando al CONTRATANTE. '
    + 'CL\u00c1USULA 15. TERMINACI\u00d3N: Cualquiera de las Partes podr\u00e1 terminar el contrato por incumplimiento material de la otra Parte no subsanado dentro de los treinta (30) d\u00edas siguientes a la notificaci\u00f3n escrita. El CONTRATANTE podr\u00e1 terminar por conveniencia con preaviso de treinta (30) d\u00edas, pagando los valores causados hasta la fecha efectiva de terminaci\u00f3n. '
    + 'CL\u00c1USULA 16. REVERSIBILIDAD Y BORRADO DE DATOS: A la terminaci\u00f3n, el CONTRATISTA pondr\u00e1 a disposici\u00f3n del CONTRATANTE, dentro de los quince (15) d\u00edas siguientes, una exportaci\u00f3n de Datos del Contratante en formato CSV/JSON. Transcurridos treinta (30) d\u00edas desde la exportaci\u00f3n, el CONTRATISTA proceder\u00e1 al borrado seguro de los datos, salvo obligaci\u00f3n legal de conservaci\u00f3n. '
    + 'CL\u00c1USULA 17. LEY APLICABLE Y SOLUCI\u00d3N DE CONTROVERSIAS: Este contrato se rige por las leyes de la Rep\u00fablica de Colombia. Las controversias se someter\u00e1n a un mecanismo escalonado: (i) negociaci\u00f3n directa entre representantes; (ii) conciliaci\u00f3n; y, de no prosperar, (iii) arbitraje en derecho administrado por el Centro de Arbitraje y Conciliaci\u00f3n de la C\u00e1mara de Comercio de Cartagena, con un (1) \u00e1rbitro, en idioma espa\u00f1ol. '
    + 'CL\u00c1USULA 18. INTEGRIDAD Y MODIFICACIONES: Este documento, junto con sus anexos, constituye el acuerdo \u00edntegro entre las Partes y reemplaza entendimientos previos. Cualquier modificaci\u00f3n requerir\u00e1 forma escrita suscrita por las Partes.';
  }

  private getAnexosText(): string {
    return 'ANEXOS | ANEXO A \u2013 ALCANCE T\u00c9CNICO / SOW (Statement of Work): A.1 Descripci\u00f3n funcional y t\u00e9cnica del Software. A.2 Perfiles y roles de usuario. A.3 Par\u00e1metros de configuraci\u00f3n inicial. A.4 Integraciones est\u00e1ndar (si aplica). A.5 Criterios de aceptaci\u00f3n y pruebas de recibo. '
    + 'ANEXO B \u2013 ACUERDO DE TRATAMIENTO DE DATOS (DPA): B.1 Rol de las Partes. B.2 Finalidades. B.3 Categor\u00edas de datos y titulares. B.4 Subencargados: AWS (us-east-1). B.5 Medidas de seguridad. B.6 Notificaci\u00f3n de incidentes. B.7 Derechos de titulares (ARCO). B.8 Transferencias internacionales. B.9 Devoluci\u00f3n y supresi\u00f3n al t\u00e9rmino. '
    + 'ANEXO C \u2013 ACUERDO DE NIVELES DE SERVICIO (SLA): C.1 Soporte: L-V 8:00\u201318:00 (COL). C.2 Canales: correo y mesa de ayuda. C.3 Tiempos de respuesta: Alta (4h), Media (8h), Baja (16h). C.4 Mantenimiento programado: aviso \u226548h. C.5 Disponibilidad: razonable; sin cr\u00e9ditos econ\u00f3micos. '
    + 'REFERENCIAS NORMATIVAS: Ley 23/1982 (Derechos de autor). Decisi\u00f3n Andina 351/1993. Ley 1581/2012 (Datos personales). Decreto 1377/2013. Ley 527/1999 (Comercio electr\u00f3nico). Decreto 2364/2012 (Firma electr\u00f3nica). Art. 476 E.T. (IVA excluido en nube).';
  }

  private generateContractHTML(contrato: Contract): string {
    const v = this.getContractVars(contrato);
    const body = this.getContractBodyText(contrato);
    return '<div class="contract-pdf-content" style="font-family: Arial, sans-serif; font-size: 9px; line-height: 1.4; text-align: justify; max-height: 70vh; overflow-y: auto; padding: 20px;">'
    + '<div style="text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 8px;">CONTRATO DE PRESTACI\u00d3N DE SERVICIOS SAAS</div>'
    + '<div style="text-align: center; font-weight: bold; font-size: 10px; margin-bottom: 15px;">CONTRATO No. ' + (contrato.code || contrato.id) + '</div>'
    + '<p style="margin: 0 0 10px 0;">' + body + '</p>'
    + '<p style="margin: 15px 0 10px 0;">En constancia se firma en medio electr\u00f3nico en la fecha indicada en el encabezado o acta de inicio.</p>'
    + '<table style="width: 100%; font-size: 9px; margin-top: 15px;"><tr>'
    + '<td style="width: 50%; vertical-align: top; padding-right: 20px;"><strong>CONTRATISTA:</strong><br>CYCLONET S. A. S<br>NIT 901.515.884-3<br>Representante legal: ALFREDO MAMBY BOSSA<br>CC: 7921161<br><br><br>Firma: ___________________________<br>Ciudad y fecha: ' + v.fechaSistema + '</td>'
    + '<td style="width: 50%; vertical-align: top;"><strong>CONTRATANTE:</strong><br>' + v.clientName + '<br>' + v.docType + ' ' + v.docNumber + '<br>Representante: ' + v.contactName + '<br><br><br>Firma: ___________________________<br>Ciudad y fecha: ' + v.fechaSistema + '</td>'
    + '</tr></table>'
    + '<hr style="margin: 20px 0;">'
    + '<p style="font-size: 8px;">' + this.getAnexosText() + '</p>'
    + '</div>';
  }


  /**
   * Convierte un número a su representación en letras (español colombiano).
   */
  private numberToWords(num: number): string {
    const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (num === 0) return 'cero';
    if (num === 100) return 'cien';
    if (num === 1000000) return 'un millón';

    let result = '';

    // Millones
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      if (millions === 1) {
        result += 'un millón ';
      } else {
        result += this.convertHundreds(millions) + ' millones ';
      }
      num %= 1000000;
    }

    // Miles
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        result += 'mil ';
      } else {
        result += this.convertHundreds(thousands) + ' mil ';
      }
      num %= 1000;
    }

    // Centenas, decenas y unidades
    if (num > 0) {
      result += this.convertHundreds(num);
    }

    return result.trim();
  }

  private convertHundreds(num: number): string {
    const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    let result = '';

    if (num >= 100) {
      if (num === 100) {
        result += 'cien';
      } else {
        result += hundreds[Math.floor(num / 100)] + ' ';
      }
      num %= 100;
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        result += ' y ' + units[num % 10];
      }
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += units[num];
    }

    return result;
  }

  /**
   * Formatea valores monetarios al formato colombiano.
   */
  private formatCurrency(value: string | number): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return '$' + numValue.toLocaleString('es-CO') + ',oo';
  }

  /**
   * Genera el PDF y lo sube al servidor.
   */
  private async generateAndUploadPDF(contrato: Contract): Promise<void> {
    const pdf = new jsPDF();
    this.writeContractToPDF(pdf, contrato);
    const pdfBuffer = pdf.output('arraybuffer');
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    return new Promise((resolve, reject) => {
      this.contractPdfService.uploadContractPDF(contrato.id, base64PDF).subscribe({
        next: (result) => { console.log('PDF subido exitosamente:', result.pdfUrl); resolve(); },
        error: (error) => { console.error('Error subiendo PDF:', error); reject(error); }
      });
    });
  }

  private downloadContractPDF(contrato: Contract) {
    const pdf = new jsPDF();
    this.writeContractToPDF(pdf, contrato);
    pdf.save('Contrato_' + (contrato.code || contrato.id) + '.pdf');
  }

  private writeContractToPDF(pdf: jsPDF, contrato: Contract): void {
    const v = this.getContractVars(contrato);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginL = 15;
    const marginR = 15;
    const contentW = pageW - marginL - marginR;
    const fontSize = 6.5;
    const lineH = 2.8;
    let y = 12;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text('CONTRATO DE PRESTACI\u00d3N DE SERVICIOS SAAS', pageW / 2, y, { align: 'center' });
    y += 4;
    pdf.setFontSize(8);
    pdf.text('CONTRATO No. ' + (contrato.code || contrato.id), pageW / 2, y, { align: 'center' });
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);

    const bodyText = this.getContractBodyText(contrato);
    const lines = pdf.splitTextToSize(bodyText, contentW);

    for (let i = 0; i < lines.length; i++) {
      if (y > pageH - 20) {
        pdf.addPage();
        y = 12;
      }
      pdf.text(lines[i], marginL, y, { align: 'justify', maxWidth: contentW });
      y += lineH;
    }

    y += 4;
    if (y > pageH - 50) { pdf.addPage(); y = 12; }

    pdf.setFontSize(fontSize);
    pdf.text('En constancia se firma en medio electr\u00f3nico en la fecha indicada en el encabezado o acta de inicio.', marginL, y);
    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.text('CONTRATISTA:', marginL, y);
    pdf.text('CONTRATANTE:', pageW / 2 + 5, y);
    pdf.setFont('helvetica', 'normal');
    y += lineH;
    pdf.text('CYCLONET S. A. S', marginL, y);
    pdf.text(v.clientName, pageW / 2 + 5, y);
    y += lineH;
    pdf.text('NIT 901.515.884-3', marginL, y);
    pdf.text(v.docType + ' ' + v.docNumber, pageW / 2 + 5, y);
    y += lineH;
    pdf.text('Rep. legal: ALFREDO MAMBY BOSSA', marginL, y);
    pdf.text('Representante: ' + v.contactName, pageW / 2 + 5, y);
    y += lineH;
    pdf.text('CC: 7921161', marginL, y);
    y += 8;
    pdf.text('Firma: ___________________________', marginL, y);
    pdf.text('Firma: ___________________________', pageW / 2 + 5, y);
    y += lineH;
    pdf.text('Ciudad y fecha: ' + v.fechaSistema, marginL, y);
    pdf.text('Ciudad y fecha: ' + v.fechaSistema, pageW / 2 + 5, y);

    y += 8;
    if (y > pageH - 30) { pdf.addPage(); y = 12; }
    pdf.setFontSize(5.5);
    const anexosLines = pdf.splitTextToSize(this.getAnexosText(), contentW);
    for (let i = 0; i < anexosLines.length; i++) {
      if (y > pageH - 10) { pdf.addPage(); y = 12; }
      pdf.text(anexosLines[i], marginL, y);
      y += 2.2;
    }
  }

  /**
   * Establece el contrato seleccionado o lo deselecciona.
   */
  setSelectedContrato(contrato: Contract) { 
    if (this.selectedContrato() === contrato) {
        this.selectedContrato.set(null);
    } else {
      this.selectedContrato.set(contrato);
      this.showToast(`RECORD SELECTED: ${contrato.id}`, 'success', 'A', 0);
    }
  }

  /**
   * Abre el modal de confirmación de eliminación (reemplazo de confirm()).
   * Esta función debe ser llamada por el botón "Eliminar".
   */
  openDeleteConfirmationModal() {
    if (this.selectedContrato()) {
        this.isDeleteConfirmationModalOpen.set(true);
    } else {
        this.showToast('ERROR: No record selected for deletion.', 'warning', 'A', 0);
    }
  }

  /**
   * Cierra el modal de confirmación.
   */
  cancelDelete() {
    this.isDeleteConfirmationModalOpen.set(false);
  }

  /**
   * Ejecuta la eliminación del contrato seleccionado.
   * Esta función debe ser llamada por el botón "Confirmar" dentro del modal.
   */
  deleteContrato() { 
    const contrato = this.selectedContrato();
    if (contrato) {
        const idToDelete = contrato.id;
        
        // Actualiza el signal 'contratos' filtrando el elemento
        this.contratos.update(currentContratos => 
          currentContratos.filter(c => c.id !== idToDelete)
        );
        
        this.showToast(`RECORD ${idToDelete} DELETED successfully (Local Simulation).`, 'danger', 'A', 0);
        this.selectedContrato.set(null);
        this.isDeleteConfirmationModalOpen.set(false); // Cierra el modal
    } else {
      this.showToast('ERROR: No record selected for deletion.', 'warning', 'A', 0);
    }
  }

  /**
   * Función trackBy para optimización.
   */
  trackById(index: number, contrato: Contract): string { 
    return contrato.id;
  }

  // --- Funciones de Notificación ---

  /**
   * Elimina una notificación por índice.
   */
  removeNotification(index: number) {
    // Actualiza el signal 'notifications' eliminando el elemento por índice
    this.notifications.update(currentNotifications => {
        currentNotifications.splice(index, 1);
        return [...currentNotifications];
    });
  }

  /**
   * Muestra una notificación temporal (A) o persistente (B).
   */
  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
    const notification = {
      title: message,
      type,
      alertType,
      container,
      visible: true
    };
    
    // Agrega la notificación al array de signals
    this.notifications.update(currentNotifications => [...currentNotifications, notification]);

    if (alertType === 'A') {
      // Configura la eliminación automática después de 5 segundos
      setTimeout(() => {
        this.notifications.update(currentNotifications => 
            currentNotifications.filter(n => n !== notification)
        );
      }, 5000);
    }
  }

  /**
   * Abre el dropdown de estados en la posición del elemento clickeado
   */
  openStatusDropdown(event: MouseEvent, contractId: string) {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.statusDropdownPosition.set({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX
    });
    this.statusDropdownOpen.set(contractId);
  }

  /**
   * Cierra el dropdown de estados
   */
  closeStatusDropdown() {
    this.statusDropdownOpen.set(null);
  }

  /**
   * Opens a SweetAlert select for changing contract status from the modal
   */
  openStatusChangeFromModal(contrato: any) {
    const inputOptions: Record<string, string> = {};
    this.contractStatuses.forEach(s => { inputOptions[s] = s; });

    Swal.fire({
      title: 'Change Status',
      input: 'select',
      inputOptions,
      inputValue: contrato.status,
      showCancelButton: true,
      confirmButtonText: 'Change',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.changeContractStatus(contrato.id, result.value);
      }
    });
  }

  /**
   * Cambia el estado del contrato
   */
  changeContractStatus(contractId: string, newStatus: string) {
    // Si es activación, validar el flujo completo
    if (newStatus === 'ACTIVE') {
      const contract = this.contratos().find(c => c.id === contractId);
      if (contract) {
        // Step 1: Validar PDF generado
        if (!contract.pdfUrl || contract.pdfUrl.trim() === '') {
          Swal.fire({
            title: 'Contract PDF Required',
            text: 'You must generate the contract PDF first. Use the PDF button in the contract details.',
            icon: 'warning',
            confirmButtonText: 'Understood'
          });
          this.closeStatusDropdown();
          return;
        }
        
        // Step 2: Validar que fue emitido (enviado al cliente)
        if (!contract.issuedAt) {
          Swal.fire({
            title: 'Contract Not Issued',
            text: 'The contract must be issued (sent to the client for review) before it can be activated. Use the "Issue" action to send it.',
            icon: 'warning',
            confirmButtonText: 'Understood'
          });
          this.closeStatusDropdown();
          return;
        }

        // Step 3: Validar firma
        if (!contract.signedAt) {
          Swal.fire({
            title: 'Contract Not Signed',
            text: 'The contract must be signed by the client before activation. Use the "Sign" action once the client confirms.',
            icon: 'warning',
            confirmButtonText: 'Understood'
          });
          this.closeStatusDropdown();
          return;
        }
        
        // All validations passed — confirm activation
        Swal.fire({
          title: 'Activate Contract',
          text: 'The contract has been generated, issued, and signed. Do you want to activate it now?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, activate',
          cancelButtonText: 'Cancel',
          reverseButtons: true
        }).then((result) => {
          if (result.isConfirmed) {
            this.proceedWithActivation(contractId, newStatus);
          } else {
            this.closeStatusDropdown();
          }
        });
        
        return;
      }
    }
    
    // Para otros estados que no sean ACTIVE
    this.proceedWithActivation(contractId, newStatus);
  }
  
  /**
   * Procede con la activación del contrato después de las validaciones
   */
  private proceedWithActivation(contractId: string, newStatus: string) {
    // Mostrar spinner solo para activación
    if (newStatus === 'ACTIVE') {
      Swal.fire({
        title: 'Activating contract...',
        text: 'Validating requirements and activating the contract',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    }
    
    this.factonetService.updateContractStatus(contractId, newStatus).subscribe({
      next: () => {
        // Actualizar el contrato en la lista local
        this.contratos.update(contracts => 
          contracts.map(contract => 
            contract.id === contractId 
              ? { ...contract, status: newStatus }
              : contract
          )
        );
        
        if (newStatus === 'ACTIVE') {
          Swal.fire({
            title: 'Activated!',
            text: 'The contract has been successfully activated.',
            icon: 'success',
            confirmButtonText: 'OK'
          });
        } else {
          this.showToast(`Status updated to ${newStatus}`, 'success', 'A', 0);
        }
        this.closeStatusDropdown();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Error al actualizar el estado';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        this.closeStatusDropdown();
        console.error('Error updating contract status:', error);
      }
    });
  }

  signContract(contrato: any) {
    if (!contrato.pdfUrl) {
      Swal.fire({
        title: 'Cannot sign',
        text: 'The contract PDF must be generated before signing.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    Swal.fire({
      title: 'Sign Contract',
      text: `Are you sure you want to mark contract ${contrato.code} as signed?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, sign it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.factonetService.signContract(contrato.id).subscribe({
          next: (response) => {
            // Update local state
            this.contratos.update(contracts =>
              contracts.map(c => c.id === contrato.id ? { ...c, signedAt: new Date().toISOString() } : c)
            );
            if (this.modalContrato) {
              this.modalContrato = { ...this.modalContrato, signedAt: new Date().toISOString() };
            }
            Swal.fire('Signed!', 'The contract has been signed successfully.', 'success');
          },
          error: (error) => {
            Swal.fire('Error', error.error?.message || 'Failed to sign contract.', 'error');
          }
        });
      }
    });
  }
}