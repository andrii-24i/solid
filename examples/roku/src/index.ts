import './compiled-components/BaseAppScene.xml';
import { defineAnchorNode, main, registerAnchorNode } from '@roku-sdk/rsg-ts';
import { RokuProof } from './native';

const app = defineAnchorNode(
  {
    componentName: 'SolidtvRokuProof',
    extends: 'Group',
    inputFields: {},
    outputFields: {},
  },
  RokuProof,
);
main(() => registerAnchorNode(app));
