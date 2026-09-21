// Scripted presentation state only. No wagering service or production odds.
export const MULTIPLIERS=[1.50,1.80,2.10,2.50,3.00,3.60];
export class PiratePreview {
  constructor(){this.reset();}
  reset(){this.phase='ready';this.balance=25000;this.stake=1000;this.index=-1;this.difficulty='easy';this.returned=0;this.error='';this.loss=null;this.stepToken=(this.stepToken??0)+1;return this;}
  setStake(raw){
    if(!['ready','funds'].includes(this.phase))return false;
    const text=String(raw).trim(),value=Number(text);
    this.stake=Number.isFinite(value)?Math.round(value*100):0;
    this.error=!text||!Number.isFinite(value)||value<=0?'Enter a valid stake.':!/^(\d+)(\.\d{0,2})?$/.test(text)?'Use up to two decimal places.':this.stake>this.balance?'Your stake is higher than your demo balance.':'';
    this.phase=this.error?'funds':'ready';return !this.error;
  }
  setDifficulty(value){if(this.phase!=='ready'||!['easy','medium','hard','hardcore'].includes(value))return false;this.difficulty=value;return true;}
  advance(){
    if(this.phase==='ready'){
      if(this.stake<=0||this.stake>this.balance||this.error)return null;
      this.balance-=this.stake;this.returned=0;this.loss=null;
    }else if(this.phase!=='active'||this.index>=MULTIPLIERS.length-1)return null;
    this.phase='jump';return ++this.stepToken;
  }
  resolve(token,outcome='success'){
    if(token!==this.stepToken||this.phase!=='jump')return false;
    if(outcome==='success'){this.index++;this.phase='active';}
    else {this.loss=outcome;this.phase='loss';this.returned=0;}
    return true;
  }
  cashout(){
    if(this.phase!=='active'||this.index<0)return false;
    this.returned=Math.round(this.stake*MULTIPLIERS[this.index]);this.balance+=this.returned;this.phase='cashout';this.stepToken++;return true;
  }
  nextRound(){
    if(!['cashout','loss'].includes(this.phase))return false;
    this.phase='ready';this.index=-1;this.returned=0;this.loss=null;this.stepToken++;this.error=this.stake>this.balance?'Your stake is higher than your demo balance.':'';if(this.error)this.phase='funds';return true;
  }
  scenario(name){
    this.reset();
    if(name==='ready')return;
    if(name==='funds'){this.setStake('300');return;}
    this.balance-=this.stake;this.index=0;this.phase='active';
    if(name==='jump'){this.phase='jump';this.stepToken++;}
    else if(name==='cashout')this.cashout();
    else if(['sink','shark','tentacle'].includes(name)){this.phase='loss';this.loss=name;}
    else if(name==='reconnecting')this.phase='reconnecting';
  }
  get current(){return this.index<0?null:MULTIPLIERS[this.index];}
  get next(){return MULTIPLIERS[this.index+1]??null;}
  get cashValue(){return this.index<0?0:Math.round(this.stake*MULTIPLIERS[this.index]);}
}
