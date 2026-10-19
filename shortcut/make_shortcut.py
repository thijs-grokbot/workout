# Genereert een ONGETEKENDE .shortcut (plist) met placeholders <<EXEC_URL>> en <<TOKEN>>. Geen echte token in dit bestand.
import plistlib, uuid
U=lambda: str(uuid.uuid4()).upper()
def out(uid,name): return {'Value':{'OutputUUID':uid,'OutputName':name,'Type':'ActionOutput'},'WFSerializationType':'WFTextTokenAttachment'}
def tok(uid,name): return {'Value':{'string':'\ufffc','attachmentsByRange':{'{0, 1}':{'OutputUUID':uid,'OutputName':name,'Type':'ActionOutput'}}},'WFSerializationType':'WFTextTokenString'}
def txt(s): return {'Value':{'string':s},'WFSerializationType':'WFTextTokenString'}
def find(uid,typ,latest1=False):
  prm={'UUID':uid,'WFContentItemFilter':{'Value':{'WFActionParameterFilterPrefix':1,'WFContentPredicateBoundedDate':False,'WFActionParameterFilterTemplates':[
    {'Bounded':True,'Operator':4,'Property':'Type','Removable':False,'Values':{'Enumeration':{'Value':typ,'WFSerializationType':'WFStringSubstitutableState'}}},
    {'Bounded':True,'Operator':1002,'Property':'Start Date','Removable':True,'Values':{'Number':'7','Unit':16}}]},'WFSerializationType':'WFContentPredicateTableTemplate'}}
  if latest1: prm.update({'WFContentItemSortProperty':'Start Date','WFContentItemSortOrder':'Latest First','WFContentItemLimitEnabled':True,'WFContentItemLimitNumber':1.0})
  return {'WFWorkflowActionIdentifier':'is.workflow.actions.filter.health.quantity','WFWorkflowActionParameters':prm}
def det(uid,src,prop): return {'WFWorkflowActionIdentifier':'is.workflow.actions.properties.health.quantity','WFWorkflowActionParameters':{'UUID':uid,'WFContentItemPropertyName':prop,'WFInput':out(src,'Health Samples')}}
def comb(uid,src,name): return {'WFWorkflowActionIdentifier':'is.workflow.actions.text.combine','WFWorkflowActionParameters':{'UUID':uid,'WFTextSeparator':'New Lines','text':out(src,name)}}
def kv(k,v): return {'WFItemType':0,'WFKey':txt(k),'WFValue':v}
A,B,C,D,E,F,G,H=(U() for _ in range(8))
acts=[
 {'WFWorkflowActionIdentifier':'is.workflow.actions.comment','WFWorkflowActionParameters':{'WFCommentActionText':'VOLGAS Gezondheid: stuurt HRV (vannacht/vanochtend) en rusthartslag van vandaag naar je trainer. Lege data = niets opgeslagen. Vul <<EXEC_URL>> en <<TOKEN>> in.'}},
 find(A,'Heart Rate Variability'),
 det(B,A,'Value'), comb(C,B,'Details of Health Sample'),
 det(D,A,'Start Date'), comb(E,D,'Details of Health Sample'),
 find(F,'Resting Heart Rate',True),
 det(G,F,'Value'),
 {'WFWorkflowActionIdentifier':'is.workflow.actions.downloadurl','WFWorkflowActionParameters':{'UUID':H,'WFURL':'<<EXEC_URL>>','WFHTTPMethod':'POST','WFHTTPBodyType':'JSON',
   'ShowHeaders':True,'WFHTTPHeaders':{'Value':{'WFDictionaryFieldValueItems':[kv('Content-Type',txt('application/json'))]},'WFSerializationType':'WFDictionaryFieldValue'},
   'WFJSONValues':{'Value':{'WFDictionaryFieldValueItems':[kv('action',txt('health')),kv('token',txt('<<TOKEN>>')),kv('hrv_ms',tok(C,'Combined Text')),kv('hrv_ts',tok(E,'Combined Text')),kv('resting_hr',tok(G,'Details of Health Sample')),kv('source',txt('ios-opdracht'))]},'WFSerializationType':'WFDictionaryFieldValue'}}},
]
sc={'WFWorkflowActions':acts,'WFWorkflowClientVersion':'2607.0.2','WFWorkflowMinimumClientVersion':900,'WFWorkflowMinimumClientVersionString':'900',
 'WFWorkflowIcon':{'WFWorkflowIconStartColor':4282601983,'WFWorkflowIconGlyphNumber':59511},'WFWorkflowImportQuestions':[],'WFWorkflowInputContentItemClasses':[],
 'WFWorkflowOutputContentItemClasses':[],'WFWorkflowTypes':[],'WFWorkflowHasShortcutInputVariables':False,'WFQuickActionSurfaces':[]}
with open('VOLGAS-Gezondheid.unsigned.shortcut','wb') as f: plistlib.dump(sc,f,fmt=plistlib.FMT_BINARY)
with open('VOLGAS-Gezondheid.unsigned.xml.plist','wb') as f: plistlib.dump(sc,f,fmt=plistlib.FMT_XML)
print('ok',len(acts),'acties')
